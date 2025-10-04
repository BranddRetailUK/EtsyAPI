function setTokens(sess, tokens) {
  sess.etsy = {
    ...(sess.etsy || {}),
    tokens,
    userId: parseUserIdFromAccessToken(tokens?.access_token),
    obtainedAt: Date.now()
  };
}

function getTokens(sess) {
  return sess?.etsy?.tokens || null;
}

function getUserId(sess) {
  return sess?.etsy?.userId || null;
}

function clearTokens(sess) {
  if (sess?.etsy) delete sess.etsy;
}

function parseUserIdFromAccessToken(accessToken = '') {
  const prefix = accessToken.split('.')[0];
  return /^\d+$/.test(prefix) ? prefix : null;
}

module.exports = {
  setTokens,
  getTokens,
  getUserId,
  clearTokens,
  parseUserIdFromAccessToken
};
