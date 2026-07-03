import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, name, subject, body, schoolName } = req.body;

    if (!email || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'eduone.africa@gmail.com',
        pass: process.env.SMTP_PASS,
      },
    });

    const textContent = `Dear ${name || 'Staff Member'},

You have received a new message from the ${schoolName || 'EduOne'} Administration:

----------------------------------------
Subject: ${subject}

${body}
----------------------------------------

Please log in to your portal at https://www.edu1app.tech to view this message and respond if necessary.

Best regards,
Administration
${schoolName || 'EduOne'}`;

    const info = await transporter.sendMail({
      from: '"EduOne Systems" <eduone.africa@gmail.com>',
      to: email,
      subject: `[${schoolName || 'EduOne'}] ${subject}`,
      text: textContent,
    });

    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
