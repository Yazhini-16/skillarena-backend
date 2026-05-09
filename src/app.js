const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Health check first — always responds immediately
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', ts: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Backend is running' });
});

app.use(helmet());

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://skillarena-frontend-one.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

// This handles preflight OPTIONS requests automatically
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// Razorpay webhook needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(apiLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/matches', require('./routes/match'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/practice', require('./routes/practice'));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;