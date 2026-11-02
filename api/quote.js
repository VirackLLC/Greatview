const { Resend } = require('resend');

const escapeHTML = value => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

// Injecting the transport permits tests to exercise delivery without sending real email.
function createQuoteHandler(getResend) {
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
    if (!name.trim() || !phone.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !['Pavers', 'Artificial Turf', 'Gravel', 'Irrigation', 'Custom Designs'].includes(service)) {
      return res.status(400).json({ error: 'Please provide your name, phone, email, and service.' });
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
