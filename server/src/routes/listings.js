const express = require('express');
const { makeEtsyClient } = require('../services/etsyClient');
const { getTokens } = require('../services/tokenStore');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

// Active listings by shop
router.get('/shops/:shopId/listings/active', requireAuth, async (req, res) => {
  try {
    const { shopId } = req.params;
    const tokens = getTokens(req.session);
    const client = makeEtsyClient(tokens.access_token);

    const { data } = await client.get(`/application/shops/${shopId}/listings/active?limit=25`);
    res.json(data);
  } catch (err) {
    console.error('listings error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to load listings' });
  }
});

// Create a minimal draft listing
router.post('/shops/:shopId/listings/draft', requireAuth, async (req, res) => {
  try {
    const { shopId } = req.params;
    const {
      title, description, price,
      who_made, when_made, is_supply,
      taxonomy_id, shipping_profile_id
    } = req.body;

    const tokens = getTokens(req.session);
    const client = makeEtsyClient(tokens.access_token);

    const payload = {
      title,
      description,
      price,
      who_made,
      when_made,
      is_supply,
      taxonomy_id,
      shipping_profile_id,
      state: 'DRAFT'
    };

    const { data } = await client.post(`/application/shops/${shopId}/listings`, payload);
    res.json(data);
  } catch (err) {
    console.error('create draft listing error:', err.response?.data || err.message);
    res.status(400).json({ error: 'Failed to create draft listing', detail: err.response?.data || err.message });
  }
});

module.exports = router;
