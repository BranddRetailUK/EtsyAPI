const crypto = require('crypto');

function randomString(len = 64) {
  return crypto.randomBytes(len).toString('base64url');
}

function codeChallengeFromVerifier(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return Buffer.from(hash).toString('base64url');
}

module.exports = { randomString, codeChallengeFromVerifier };
