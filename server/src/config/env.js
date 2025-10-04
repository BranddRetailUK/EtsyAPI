require('dotenv/config');

const config = {
  port: process.env.PORT || 4000,
  sessionSecret: process.env.SESSION_SECRET,
  apiKey: process.env.ETSY_API_KEY,
  sharedSecret: process.env.ETSY_SHARED_SECRET,
  redirectUri: process.env.OAUTH_REDIRECT_URI,
  scopes: process.env.ETSY_SCOPES || 'shops_r listings_r'
};

module.exports = { config };
