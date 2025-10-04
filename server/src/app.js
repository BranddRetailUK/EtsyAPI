// server/src/app.js (CommonJS)

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const RedisStore = require('connect-redis').default;   // NEW (for production sessions)
const { Redis } = require('ioredis');                  // NEW (Redis client)

const { config } = require('./config/env');

// API routes (CommonJS)
const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shops');
const listingRoutes = require('./routes/listings');
const orderRoutes = require('./routes/orders');

const app = express();

/** Trust Railway/NGINX proxy so req.secure/cookies work properly */
app.set('trust proxy', 1);

/** CORS allow-list (env: ALLOWED_ORIGINS="https://your.app,http://localhost:4000") */
const allowList = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// If no allowList provided, default to allowing same-origin & tools (no Origin) – handy for local dev
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/postman/no-origin
    if (allowList.length === 0 || allowList.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/** Sessions (Redis in production if REDIS_URL is set; MemoryStore fallback in dev) */
const isProd = process.env.NODE_ENV === 'production';

// Create Redis client only if REDIS_URL provided
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true
    })
  : null;

// Use RedisStore when redis client exists (production), else default MemoryStore (dev only)
const store = redis ? new RedisStore({ client: redis, prefix: 'sess:' }) : undefined;

app.use(session({
  name: 'etsy.sid',
  secret: config.sessionSecret,
  store,                 // Redis in production; undefined (MemoryStore) locally
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,      // secure cookies over HTTPS in production
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

/** -------- API routes -------- */
app.use('/auth', authRoutes);
app.use('/api', shopRoutes);
app.use('/api', listingRoutes);
app.use('/api', orderRoutes);

/** -------- Static frontend -------- */
const publicDir = path.resolve(__dirname, '../../frontend/public');
app.use(express.static(publicDir));

/** Health check */
app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/**
 * Express 5-safe SPA fallback:
 * - Use a regex instead of '*' (path-to-regexp@6 no longer supports raw '*')
 * - This must be last, after API/static routes
 */
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

/** -------- Start server -------- */
app.listen(config.port, () => {
  console.log(`Server listening on :${config.port}`);
});
