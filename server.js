require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.OPENROUTER_API_KEY) {
  console.error('Missing OPENROUTER_API_KEY');
  process.exit(1);
}

app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
if (allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins }));
} else {
  app.use(cors());
}

app.use(rateLimit({ windowMs: 60000, max: 30 }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  try {
    const { model, messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages' });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({ model: model || 'z-ai/glm-4.5-air:free', messages })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
