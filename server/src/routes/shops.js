const express = require('express');
const { makeEtsyClient } = require('../services/etsyClient');
const { getTokens, getUserId } = require('../services/tokenStore');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

// Get the authenticated user's shops
router.get('/me/shops', requireAuth, async (req, res) => {
  try {
    const tokens = getTokens(req.session);
    const userId = getUserId(req.session);
    const client = makeEtsyClient(tokens.access_token);

    const { data } = await client.get(`/application/users/${userId}/shops`);
    res.json(data);
  } catch (err) {
    console.error('shops error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to load shops' });
  }
});

module.exports = router;
