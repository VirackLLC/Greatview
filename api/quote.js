import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  const { name, phone, email, service, message } = req.body;

  await resend.emails.send({
    from: 'Greatview <onboarding@resend.dev>',
    to: 'greatview.hardscape@gmail.com',
    subject: 'New Consultation Request',
    html: `<p>${name} - ${phone}</p>`
  });

  res.status(200).json({ success: true });
}
