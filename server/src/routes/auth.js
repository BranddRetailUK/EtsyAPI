const express = require('express');
const axios = require('axios');
const { config } = require('../config/env');
const { randomString, codeChallengeFromVerifier } = require('../services/pkce');
const { setTokens, clearTokens } = require('../services/tokenStore');

const router = express.Router();

// Start OAuth (PKCE)
router.get('/login', (req, res) => {
  const state = randomString(24);
  const verifier = randomString(48);
  const challenge = codeChallengeFromVerifier(verifier);

  // Store in session
  req.session.oauth = { state, verifier };

  // Ensure session is persisted before redirecting to Etsy
  req.session.save((err) => {
    if (err) {
      console.error('[OAuth] session save error:', err);
      return res.status(500).send('Session error');
    }
    console.log('[OAuth] saved state', state, 'sid', req.sessionID);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.apiKey,
      redirect_uri: config.redirectUri,
      scope: config.scopes,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

    res.redirect(`https://www.etsy.com/oauth/connect?${params}`);
  });
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const stored = req.session?.oauth;
    console.log('[OAuth] callback: sid', req.sessionID, 'got state', state, 'stored', stored?.state);

    if (!code || !state || !stored || stored.state !== state) {
      return res.status(400).send('Invalid OAuth state.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.apiKey,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: stored.verifier,
    });

    const resp = await axios.post(
      'https://api.etsy.com/v3/public/oauth/token',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    setTokens(req.session, resp.data);
    delete req.session.oauth;

    // Persist tokens in the same session before redirecting to the app
    req.session.save((err) => {
      if (err) {
        console.error('[OAuth] session save (post-token) error:', err);
        return res.status(500).send('Session save error');
      }
      return res.redirect('/');
    });
  } catch (err) {
    const payload = err.response?.data || err.message || err;
    console.error('OAuth callback error:', payload);
    res.status(500).send('OAuth error. Check server logs.');
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const refresh = req.session?.etsy?.tokens?.refresh_token;
    if (!refresh) return res.status(400).json({ error: 'No refresh token' });

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.apiKey,
      refresh_token: refresh,
    });

    const resp = await axios.post(
      'https://api.etsy.com/v3/public/oauth/token',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const merged = { ...req.session.etsy.tokens, ...resp.data };
    setTokens(req.session, merged);

    req.session.save(() =>
      res.json({ ok: true, tokens: { ...resp.data, access_token: '***redacted***' } })
    );
  } catch (err) {
    console.error('Refresh error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  clearTokens(req.session);
  req.session.save(() => res.json({ ok: true }));
});

module.exports = router;
