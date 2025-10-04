const { getTokens } = require('../services/tokenStore');

function requireAuth(req, res, next) {
  const tokens = getTokens(req.session);
  if (!tokens?.access_token) {
    return res.status(401).json({ error: 'Not authenticated with Etsy' });
  }
  next();
}

module.exports = { requireAuth };
