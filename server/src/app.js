// server/src/app.js (CommonJS)

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const { config } = require('./config/env');

// --- Use node-redis v4 with connect-redis v7 ---
const { createClient } = require('redis');
const RedisStore = require('connect-redis').default;

const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shops');
const listingRoutes = require('./routes/listings');
const orderRoutes = require('./routes/orders');

const app = express();

/** Make Express trust Railway/NGINX so secure cookies work */
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

/** ---------- Sessions (Redis via node-redis v4) ---------- */
const isProd = process.env.NODE_ENV === 'production';
const redisUrl = process.env.REDIS_URL;

let store;
let redisClient;

(async () => {
  try {
    if (!redisUrl) {
      console.warn('[Session] REDIS_URL not set — using MemoryStore (dev only).');
    } else {
      redisClient = createClient({ url: redisUrl });
      redisClient.on('error', (err) => console.error('[Redis] client error:', err?.message || err));
      await redisClient.connect(); // node-redis v4 requires explicit connect
      console.log('[Redis] connected');
      store = new RedisStore({
        client: redisClient,
        prefix: 'etsyapi:sess:',
        // ttl is handled by connect-redis using cookie.maxAge; can override with ttl: seconds
      });
    }
  } catch (e) {
    console.error('[Redis] connect failed; falling back to MemoryStore:', e?.message || e);
    store = undefined;
  }
})();

app.use(
  session({
    name: 'etsy.sid',
    secret: config.sessionSecret,
    store, // RedisStore if available; MemoryStore otherwise
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',      // allows Etsy OAuth redirect to carry cookie
      secure: isProd,       // secure cookies in prod (requires trust proxy)
      maxAge: 1000 * 60 * 30, // 30 minutes idle timeout
      path: '/',
      // domain: undefined, // set only if you use a custom apex and need cross-subdomain
    },
  })
);

// Trace session continuity across OAuth flow
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
