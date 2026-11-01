const { getPublicConfig } = require('../server/public-config.cjs');
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const config = getPublicConfig();
  if (!config) {
    if (process.env.SUPABASE_URL || process.env.SUPABASE_ANON_KEY) return res.status(503).json({ error: 'Published photos need configuration.' });
    return res.status(200).json({ configured: false });
  }
  const { url, key } = config;
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/site_content?id=eq.1&select=content,version`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error('Content request failed');
    const rows = await response.json();
    if (!rows[0]) throw new Error('Site content has not been initialized');
    return res.status(200).json({ configured: true, ...rows[0] });
  } catch {
    return res.status(503).json({ error: 'Published photos are temporarily unavailable.' });
  }
};
