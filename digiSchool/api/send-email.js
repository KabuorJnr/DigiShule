import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS configuration (allow requests from the frontend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, name, role, schoolName } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'eduone.africa@gmail.com',
        pass: 'vfyf bcqg ylei mklf',
      },
    });

    const isTeacher = role === 'teacher' || role === 'staff';
    const roleDisplay = isTeacher ? 'Staff/Teacher' : 'Parent Portal';

    const textContent = `Dear ${name},

Welcome to ${schoolName || 'EduOne'}! 

Your ${roleDisplay} account has been successfully provisioned. 
Please find your secure login credentials below:

Portal URL: https://www.edu1app.tech
Login Email: ${email}
Temporary Password: ${password}

Please log in at your earliest convenience to access your dashboard. We highly recommend changing your password upon your first login to maintain account security.

If you have any questions or require assistance, please contact the school administration.

Best regards,
Administration
${schoolName || 'EduOne'}`;

    const info = await transporter.sendMail({
      from: '"EduOne Systems" <eduone.africa@gmail.com>',
      to: email,
      subject: `Welcome to ${schoolName || 'EduOne'} - Account Details`,
      text: textContent,
    });

    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
