// These are public credentials, not a service-role key. Authorization is enforced by RLS.
const { getPublicConfig } = require('../server/public-config.cjs');
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const config = getPublicConfig();
  if (!config) return res.status(503).json({ error: 'Owner tools are not connected yet.' });
  return res.status(200).json(config);
};
