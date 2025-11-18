require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// 1. CONFIGURATION & VALIDATION
// ============================================

// Validate required environment variables
if (!process.env.OPENROUTER_API_KEY) {
  console.error('❌ Missing OPENROUTER_API_KEY in .env');
  process.exit(1);
}

// Security constants
const CONFIG = {
  MAX_MESSAGES: 50,              // Giới hạn số messages trong 1 request
  MAX_MESSAGE_LENGTH: 5000,      // Giới hạn độ dài mỗi message
  MAX_TOTAL_CHARS: 30000,        // Giới hạn tổng ký tự tất cả messages
  RATE_LIMIT_WINDOW: 60000,      // 1 phút
  RATE_LIMIT_MAX: 15,            // 15 requests/phút (giảm từ 30)
  REQUEST_BODY_LIMIT: '50kb',    // Giảm từ 100kb
  
  // Whitelist models được phép sử dụng
 ALLOWED_MODELS: [
  'z-ai/glm-4.5-air:free',           // ✅ FREE
  'qwen/qwen2.5-vl-32b-instruct:free' // ✅ FREE
],
  
  // Roles hợp lệ
  VALID_ROLES: ['user', 'assistant', 'system']
};

// ============================================
// 2. SECURITY MIDDLEWARE
// ============================================

// Enhanced Helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
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

if (allowedOrigins.length > 0) {
  console.log('✅ CORS enabled for:', allowedOrigins);
  app.use(cors({ 
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  }));
} else {
  console.warn('⚠️  CORS: Allowing all origins (insecure for production!)');
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ALLOWED_ORIGINS must be set in production');
    process.exit(1);
  }
  app.use(cors());
}

// Rate limiting với improved configuration
const limiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW,
  max: CONFIG.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  skip: (req) => req.path !== '/api/chat', // Chỉ áp dụng cho /api/chat
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

// Body parser with size limit
app.use(express.json({ 
  limit: CONFIG.REQUEST_BODY_LIMIT,
  verify: (req, res, buf) => {
    // Thêm raw body để có thể validate
    req.rawBody = buf.toString('utf8');
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
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

/**
 * Validate và sanitize input messages
 */
function validateMessages(messages) {
  const errors = [];

  // Kiểm tra messages là array
  if (!Array.isArray(messages)) {
    return { valid: false, error: 'Messages must be an array' };
  }

  // Kiểm tra số lượng messages
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

  // Validate từng message
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Kiểm tra structure
    if (!msg || typeof msg !== 'object') {
      errors.push(`Message ${i}: Invalid format`);
      continue;
    }

    // Kiểm tra role
    if (!msg.role || !CONFIG.VALID_ROLES.includes(msg.role)) {
      errors.push(`Message ${i}: Invalid role. Must be one of: ${CONFIG.VALID_ROLES.join(', ')}`);
    }

    // Kiểm tra content
    if (typeof msg.content !== 'string') {
      errors.push(`Message ${i}: Content must be a string`);
      continue;
    }

    // Kiểm tra độ dài content
    if (msg.content.length > CONFIG.MAX_MESSAGE_LENGTH) {
      errors.push(`Message ${i}: Content too long. Maximum ${CONFIG.MAX_MESSAGE_LENGTH} characters`);
    }

    // Sanitize content - remove potential XSS
    msg.content = msg.content
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .trim();

    if (msg.content.length === 0) {
      errors.push(`Message ${i}: Content cannot be empty`);
    }

    totalChars += msg.content.length;
  }

  // Kiểm tra tổng độ dài
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

/**
 * Validate model name
 */
function validateModel(model) {
  if (!model) {
    return { valid: true, model: CONFIG.ALLOWED_MODELS[0] }; // Default model
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

/**
 * Chat endpoint với full validation
 */
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();

  try {
    const { model, messages } = req.body;

    // 1. Validate messages
    const messageValidation = validateMessages(messages);
    if (!messageValidation.valid) {
      console.warn('⚠️  Invalid messages:', messageValidation.error);
      return res.status(400).json({ 
        error: messageValidation.error,
        code: 'INVALID_MESSAGES'
      });
    }

    // 2. Validate model
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

    // 3. Call OpenRouter API
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
        // Thêm các params để kiểm soát chi phí
        max_tokens: 1000,  // Giới hạn output
        temperature: 0.7
      }),
      timeout: 30000 // 30s timeout
    });

    const data = await response.json();

    // 4. Handle OpenRouter errors
    if (!response.ok) {
      console.error('❌ OpenRouter API error:', {
        status: response.status,
        error: data.error
      });

      // Không leak chi tiết lỗi cho client
      return res.status(response.status).json({ 
        error: 'Failed to get AI response',
        code: 'API_ERROR'
      });
    }

    // 5. Log success
    const duration = Date.now() - startTime;
    console.log('✅ Request completed:', {
      duration: `${duration}ms`,
      model: selectedModel,
      tokensUsed: data.usage?.total_tokens || 'unknown'
    });

    // 6. Return response
    res.json(data);

  } catch (err) {
    const duration = Date.now() - startTime;
    
    console.error('❌ Server error:', {
      duration: `${duration}ms`,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Generic error cho client
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Models info endpoint
 */
app.get('/api/models', (req, res) => {
  res.json({ 
    models: CONFIG.ALLOWED_MODELS,
    default: CONFIG.ALLOWED_MODELS[0]
  });
});

/**
 * Serve frontend
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// 5. ERROR HANDLING
// ============================================

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

app.listen(PORT, () => {
  console.log('===========================================');
  console.log('🚀 Server started successfully');
  console.log('===========================================');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Rate limit: ${CONFIG.RATE_LIMIT_MAX} requests/${CONFIG.RATE_LIMIT_WINDOW/1000}s`);
  console.log(`🤖 Default model: ${CONFIG.ALLOWED_MODELS[0]}`);
  console.log(`📊 Max messages: ${CONFIG.MAX_MESSAGES}`);
  console.log(`📝 Max chars/message: ${CONFIG.MAX_MESSAGE_LENGTH}`);
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
