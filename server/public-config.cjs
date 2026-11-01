function getPublicConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) return null;
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
      if (payload.role !== 'anon') return null;
    } catch { return null; }
  }
  return { url: url.replace(/\/$/, ''), key };
}
module.exports = { getPublicConfig };
