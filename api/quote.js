const { Resend } = require('resend');
const defaults = require('../data.json').services.map(service => service.title);
const { getPublicConfig } = require('../server/public-config.cjs');

const escapeHTML = value => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

// Injectable providers let tests verify quote delivery without sending real email.
async function getPublishedServiceNames() {
  const config = getPublicConfig();
  if (!config) {
    if (process.env.SUPABASE_URL || process.env.SUPABASE_ANON_KEY) throw new Error('Published services are unavailable');
    return defaults;
  }
  const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/site_content?id=eq.1&select=content`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    signal: AbortSignal.timeout(6000)
  });
  if (!response.ok) throw new Error('Published services are unavailable');
  const rows = await response.json();
  const services = rows[0]?.content?.services;
  if (!Array.isArray(services)) throw new Error('Published services are unavailable');
  if (services.length === defaults.length && services.every(service => service === null || typeof service === 'string')) {
    return defaults;
  }
  if (!services.every(service => service && typeof service.title === 'string')) {
    throw new Error('Published services are unavailable');
  }
  return services.map(service => service.title);
}

function createQuoteHandler(getResend, getServiceNames = getPublishedServiceNames) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body || {};
    const limits = { name: 160, phone: 80, email: 254, service: 80, message: 5000 };
    for (const [key, limit] of Object.entries(limits)) {
      if (typeof body[key] !== 'string' || body[key].length > limit) {
        return res.status(400).json({ error: 'Please check your contact information and message.' });
      }
    }
    const { name, phone, email, service, message } = body;
    if (!name.trim() || !phone.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide your name, phone, email, and service.' });
    }
    let allowedServices;
    try {
      allowedServices = await getServiceNames();
    } catch {
      return res.status(503).json({ error: 'The service list is temporarily unavailable. Please call us instead.' });
    }
    if (!allowedServices.includes(service)) {
      return res.status(400).json({ error: 'Please choose a service from the list.' });
    }
    try {
      const result = await getResend().emails.send({
        from: 'Greatview <onboarding@resend.dev>',
        to: 'greatview.hardscape@gmail.com',
        subject: `New Consultation - ${service}`,
        html: `
          <h2>New Lead</h2>
          <p><strong>Name:</strong> ${escapeHTML(name)}</p>
          <p><strong>Phone:</strong> ${escapeHTML(phone)}</p>
          <p><strong>Email:</strong> ${escapeHTML(email)}</p>
          <p><strong>Service:</strong> ${escapeHTML(service)}</p>
          <p><strong>Message:</strong><br>${escapeHTML(message)}</p>
        `
      });
      if (result.error) throw new Error('Email provider rejected the request');
      return res.status(200).json({ success: true });
    } catch {
      console.error('Quote email delivery failed.');
      return res.status(502).json({ error: 'Your request could not be sent. Please try again or call us.' });
    }
  };
}
module.exports = createQuoteHandler(() => new Resend(process.env.RESEND_API_KEY));
module.exports.createQuoteHandler = createQuoteHandler;
module.exports.getPublishedServiceNames = getPublishedServiceNames;
