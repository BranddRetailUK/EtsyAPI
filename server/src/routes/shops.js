const express = require('express');
const { makeEtsyClient } = require('../services/etsyClient');
const { getTokens, getUserId } = require('../services/tokenStore');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/me/shops', requireAuth, async (req, res) => {
  try {
    const tokens = getTokens(req.session);
    const userId = getUserId(req.session);
    const client = makeEtsyClient(tokens.access_token);

    const { data } = await client.get(`/application/users/${userId}/shops`);

    // Normalize to { shops: [...] }
    let shops = [];
    if (Array.isArray(data)) shops = data;
    else if (Array.isArray(data?.results)) shops = data.results;
    else if (Array.isArray(data?.shops)) shops = data.shops;
    else if (data && typeof data === 'object') shops = [data]; // fallback if a single shop object somehow

    // Sort optional: name asc
    shops.sort((a, b) => (a.shop_name || '').localeCompare(b.shop_name || ''));

    return res.json({ shops });
  } catch (err) {
    console.error('shops error:', err.response?.data || err.message);
    const detail = err.response?.data?.error || 'Failed to load shops';
    res.status(404).json({ error: detail });
  }
});

module.exports = router;
