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

  req.session.oauth = { state, verifier };

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.apiKey,
    redirect_uri: config.redirectUri,
    scope: config.scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString();

  res.redirect(`https://www.etsy.com/oauth/connect?${params}`);
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const expected = req.session?.oauth?.state;
    const verifier = req.session?.oauth?.verifier;
    if (!code || !state || !expected || state !== expected) {
      return res.status(400).send('Invalid OAuth state.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.apiKey,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: verifier
    });

    const resp = await axios.post(
      'https://api.etsy.com/v3/public/oauth/token',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    setTokens(req.session, resp.data);
    delete req.session.oauth;

    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
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
      refresh_token: refresh
    });

    const resp = await axios.post(
      'https://api.etsy.com/v3/public/oauth/token',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const merged = { ...req.session.etsy.tokens, ...resp.data };
    setTokens(req.session, merged);

    res.json({ ok: true, tokens: { ...resp.data, access_token: '***redacted***' } });
  } catch (err) {
    console.error('Refresh error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  clearTokens(req.session);
  res.json({ ok: true });
});

module.exports = router;
