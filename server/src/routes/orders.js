const express = require('express');
const { makeEtsyClient } = require('../services/etsyClient');
const { getTokens } = require('../services/tokenStore');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

// Receipts (orders) for a shop
router.get('/shops/:shopId/receipts', requireAuth, async (req, res) => {
  try {
    const { shopId } = req.params;
    const tokens = getTokens(req.session);
    const client = makeEtsyClient(tokens.access_token);

    const { data } = await client.get(`/application/shops/${shopId}/receipts?limit=25&was_paid=true`);
    res.json(data);
  } catch (err) {
    console.error('receipts error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to load receipts' });
  }
});

module.exports = router;
