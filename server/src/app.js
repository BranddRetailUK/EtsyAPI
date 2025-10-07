// server/src/app.js (CommonJS)

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const connectRedis = require('connect-redis');        // works v5–v8
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
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman/no-origin
      if (allowList.length === 0 || allowList.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/** ---------- Sessions (Redis in production via REDIS_URL) ---------- */
const isProd = process.env.NODE_ENV === 'production';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.warn('[Session] REDIS_URL not set — using MemoryStore (dev only).');
}

const redisClient = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (t) => Math.min(t * 200, 5000),
    })
  : null;

/**
 * connect-redis compatibility:
 * - v5/v6: module is a function -> require('connect-redis')(session) returns Store class
 * - v7/v8 ESM: default export is Store class -> require('connect-redis').default
 * - some builds expose { RedisStore }
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

const store =
  redisClient && RedisStoreCtor
    ? new RedisStoreCtor({
        client: redisClient,
        prefix: 'etsyapi:sess:',
        disableTouch: false, // keep session alive while browsing
        ttl: 60 * 60 * 6, // 6 hours if cookie.maxAge is not present
      })
    : undefined;

app.use(
  session({
    name: 'etsy.sid',
    secret: config.sessionSecret,
    store, // Redis in prod; MemoryStore when undefined (dev)
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax', // allows Etsy OAuth redirect to carry cookie
      secure: isProd, // secure cookies in prod (requires trust proxy)
      maxAge: 1000 * 60 * 30, // 30 minutes idle timeout
      path: '/', // default
      // domain: undefined, // keep undefined unless you use a custom domain/apex
    },
  })
);

// Tiny trace to confirm session continuity across the OAuth flow
app.use((req, _res, next) => {
  console.log('[sess]', req.sessionID, 'has oauth?', !!req.session?.oauth);
  next();
});

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

/** SPA fallback */
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

/** -------- Start server -------- */
app.listen(config.port, () => {
  // Redact password when printing the URL for sanity checking
  let masked = '(none)';
  if (redisUrl) {
    try {
      const u = new URL(redisUrl);
      if (u.password) u.password = '***';
      masked = u.toString();
    } catch {
      masked = '(invalid URL)';
    }
  }
  console.log(`Server listening on :${config.port}`);
  console.log('[Env] REDIS_URL:', masked);
});
