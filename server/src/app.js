// server/src/app.js (CommonJS)

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const connectRedis = require('connect-redis');        // ← don't assume .default
const { Redis } = require('ioredis');

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

/** Sessions (Redis in production if REDIS_URL is set; MemoryStore fallback otherwise) */
const isProd = process.env.NODE_ENV === 'production';

// Create Redis client only if REDIS_URL provided
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    })
  : null;

/**
 * Connect-Redis compatibility:
 * - v5/v6: module is a function -> require('connect-redis')(session) returns a Store class
 * - v7/v8 ESM: default export is the Store class -> require('connect-redis').default
 * - Some builds expose { RedisStore } named export
 */
let RedisStoreCtor;
if (typeof connectRedis === 'function') {
  // legacy factory API
  RedisStoreCtor = connectRedis(session);
} else if (connectRedis && typeof connectRedis.default === 'function') {
  // ESM default export
  RedisStoreCtor = connectRedis.default;
} else if (connectRedis && typeof connectRedis.RedisStore === 'function') {
  // named export
  RedisStoreCtor = connectRedis.RedisStore;
}

const store = (redis && RedisStoreCtor)
  ? new RedisStoreCtor({ client: redis, prefix: 'sess:' })
  : undefined;

app.use(session({
  name: 'etsy.sid',
  secret: config.sessionSecret,
  store,                 // Redis in production; MemoryStore when undefined
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
 * Express 5-safe SPA fallback
 */
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

/** -------- Start server -------- */
app.listen(config.port, () => {
  console.log(`Server listening on :${config.port}`);
});
