require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// 1. CONFIGURATION & VALIDATION
// ============================================

if (!process.env.OPENROUTER_API_KEY) {
  console.error('❌ Missing OPENROUTER_API_KEY in .env');
  process.exit(1);
}

const CONFIG = {
  MAX_MESSAGES: 50,
  MAX_MESSAGE_LENGTH: 5000,
  MAX_TOTAL_CHARS: 30000,
  RATE_LIMIT_WINDOW: 60000,
  RATE_LIMIT_MAX: 15,
  REQUEST_BODY_LIMIT: '50kb',
  
  ALLOWED_MODELS: [
    'z-ai/glm-4.5-air:free',
    'qwen/qwen2.5-vl-32b-instruct:free'
  ],
  
  VALID_ROLES: ['user', 'assistant', 'system']
};

// ============================================
// 2. SECURITY MIDDLEWARE
// ============================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS Configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.length === 0) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'CSRF-Token'],
  credentials: true
};

app.use(cors(corsOptions));

if (allowedOrigins.length > 0) {
  console.log('✅ CORS enabled for:', allowedOrigins);
} else if (process.env.NODE_ENV === 'production') {
  console.warn('⚠️  CORS: Allowing same-origin requests (Render deployment)');
} else {
  console.log('ℹ️  CORS: Allowing all origins (development mode)');
}

// Rate limiting
const limiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW,
  max: CONFIG.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  skip: (req) => req.path !== '/api/chat',
  handler: (req, res) => {
    console.warn('⚠️  Rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      time: new Date().toISOString()
    });
    res.status(429).json({ 
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(CONFIG.RATE_LIMIT_WINDOW / 1000)
    });
  }
});

app.use(limiter);

// Body parser
app.use(express.json({ 
  limit: CONFIG.REQUEST_BODY_LIMIT,
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// ✅ CSRF Protection Setup
app.use(cookieParser());

const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  if (req.path === '/api/chat' && req.method === 'POST') {
    console.log('📥 Chat request:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('user-agent'),
      bodySize: req.get('content-length')
    });
  }
  next();
});

// ============================================
// 3. VALIDATION FUNCTIONS
// ============================================

function validateMessages(messages) {
  const errors = [];

  if (!Array.isArray(messages)) {
    return { valid: false, error: 'Messages must be an array' };
  }

  if (messages.length === 0) {
    return { valid: false, error: 'Messages array cannot be empty' };
  }

  if (messages.length > CONFIG.MAX_MESSAGES) {
    return { 
      valid: false, 
      error: `Too many messages. Maximum ${CONFIG.MAX_MESSAGES} allowed` 
    };
  }

  let totalChars = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (!msg || typeof msg !== 'object') {
      errors.push(`Message ${i}: Invalid format`);
      continue;
    }

    if (!msg.role || !CONFIG.VALID_ROLES.includes(msg.role)) {
      errors.push(`Message ${i}: Invalid role. Must be one of: ${CONFIG.VALID_ROLES.join(', ')}`);
    }

    if (typeof msg.content !== 'string') {
      errors.push(`Message ${i}: Content must be a string`);
      continue;
    }

    if (msg.content.length > CONFIG.MAX_MESSAGE_LENGTH) {
      errors.push(`Message ${i}: Content too long. Maximum ${CONFIG.MAX_MESSAGE_LENGTH} characters`);
    }

    msg.content = msg.content
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .trim();

    if (msg.content.length === 0) {
      errors.push(`Message ${i}: Content cannot be empty`);
    }

    totalChars += msg.content.length;
  }

  if (totalChars > CONFIG.MAX_TOTAL_CHARS) {
    return { 
      valid: false, 
      error: `Total message length too long. Maximum ${CONFIG.MAX_TOTAL_CHARS} characters` 
    };
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return { valid: true };
}

function validateModel(model) {
  if (!model) {
    return { valid: true, model: CONFIG.ALLOWED_MODELS[0] };
  }

  if (typeof model !== 'string') {
    return { valid: false, error: 'Model must be a string' };
  }

  if (!CONFIG.ALLOWED_MODELS.includes(model)) {
    return { 
      valid: false, 
      error: `Invalid model. Allowed models: ${CONFIG.ALLOWED_MODELS.join(', ')}` 
    };
  }

  return { valid: true, model };
}

// ============================================
// 4. API ENDPOINTS
// ============================================

// ✅ CSRF Token Endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  try {
    res.json({ 
      csrfToken: req.csrfToken(),
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('❌ CSRF token generation error:', err);
    res.status(500).json({ 
      error: 'Failed to generate CSRF token',
      code: 'CSRF_ERROR'
    });
  }
});

// ✅ Chat endpoint with CSRF protection
app.post('/api/chat', csrfProtection, async (req, res) => {
  const startTime = Date.now();

  try {
    const { model, messages } = req.body;

    const messageValidation = validateMessages(messages);
    if (!messageValidation.valid) {
      console.warn('⚠️  Invalid messages:', messageValidation.error);
      return res.status(400).json({ 
        error: messageValidation.error,
        code: 'INVALID_MESSAGES'
      });
    }

    const modelValidation = validateModel(model);
    if (!modelValidation.valid) {
      console.warn('⚠️  Invalid model:', modelValidation.error);
      return res.status(400).json({ 
        error: modelValidation.error,
        code: 'INVALID_MODEL'
      });
    }

    const selectedModel = modelValidation.model;

    console.log('✅ Request validated:', {
      model: selectedModel,
      messagesCount: messages.length,
      totalChars: messages.reduce((sum, m) => sum + m.content.length, 0)
    });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3001',
        'X-Title': 'AI Chat Assistant'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ OpenRouter API error:', {
        status: response.status,
        error: data.error
      });

      return res.status(response.status).json({ 
        error: 'Failed to get AI response',
        code: 'API_ERROR'
      });
    }

    const duration = Date.now() - startTime;
    console.log('✅ Request completed:', {
      duration: `${duration}ms`,
      model: selectedModel,
      tokensUsed: data.usage?.total_tokens || 'unknown'
    });

    res.json(data);

  } catch (err) {
    const duration = Date.now() - startTime;
    
    if (err.code === 'EBADCSRFTOKEN') {
      console.warn('⚠️  CSRF token validation failed');
      return res.status(403).json({ 
        error: 'Invalid CSRF token. Please refresh the page.',
        code: 'CSRF_INVALID',
        needRefresh: true
      });
    }
    
    console.error('❌ Server error:', {
      duration: `${duration}ms`,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    res.status(500).json({ 
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Models info
app.get('/api/models', (req, res) => {
  res.json({ 
    models: CONFIG.ALLOWED_MODELS,
    default: CONFIG.ALLOWED_MODELS[0]
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// 5. ERROR HANDLING
// ============================================

// ✅ CSRF Error Handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.warn('⚠️  CSRF validation failed:', {
      path: req.path,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    return res.status(403).json({ 
      error: 'Invalid CSRF token. Please refresh the page.',
      code: 'CSRF_INVALID',
      needRefresh: true
    });
  }
  
  next(err);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    code: 'NOT_FOUND'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path
  });

  res.status(err.status || 500).json({ 
    error: 'Internal server error',
    code: 'SERVER_ERROR'
  });
});

// ============================================
// 6. START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================');
  console.log('🚀 Server started successfully');
  console.log('===========================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 CSRF Protection: ENABLED`);
  console.log(`⚡ Rate limit: ${CONFIG.RATE_LIMIT_MAX} requests/${CONFIG.RATE_LIMIT_WINDOW/1000}s`);
  console.log(`🤖 Default model: ${CONFIG.ALLOWED_MODELS[0]}`);
  console.log('===========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  process.exit(0);
});
