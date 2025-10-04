const axios = require('axios');
const { config } = require('../config/env');

function makeEtsyClient(accessToken) {
  return axios.create({
    baseURL: 'https://api.etsy.com/v3/',
    timeout: 15000,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json'
    }
  });
}

module.exports = { makeEtsyClient };
