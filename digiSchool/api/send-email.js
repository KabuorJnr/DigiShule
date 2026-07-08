import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS configuration (allow requests from the frontend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, username, password, name, role, schoolName } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const isParent = role === 'parent';

    // Only require JWT authentication for staff/admin actions
    if (!isParent) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
      }
      const token = authHeader.replace('Bearer ', '').trim();
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Empty token' });
      }
      
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
      }
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

    const roleDisplay = isParent ? 'Parent Portal' : 'Staff/Teacher';
    const schoolNameDisplay = schoolName || 'EduOne';

    const textContent = `Dear ${name},

Welcome to ${schoolNameDisplay}! 

Your ${roleDisplay} account has been successfully provisioned. 
Please find your secure login credentials below:

Portal URL: https://www.edu1app.tech
${username ? `Login Username: ${username}` : `Login Email: ${email}`}
Temporary Password: ${password}

Please log in at your earliest convenience to access your dashboard. We highly recommend changing your password upon your first login to maintain account security.

If you have any questions or require assistance, please contact the school administration.

Best regards,
Administration
${schoolNameDisplay}`;

    let success = false;
    let messageId = null;

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: 'EduOne Africa <admin@edu1app.tech>',
          to: email,
          subject: `Welcome to ${schoolNameDisplay} - Account Details`,
          text: textContent,
        });

        if (error) {
          console.warn('Resend API failed, falling back to Nodemailer:', error.message);
        } else {
          success = true;
          messageId = data?.id;
        }
      } catch (err) {
        console.warn('Resend caught error, falling back to Nodemailer:', err.message);
      }
    }

    if (!success) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER || 'eduone.africa@gmail.com',
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: `"${schoolNameDisplay} Administration" <${process.env.SMTP_USER || 'eduone.africa@gmail.com'}>`,
        replyTo: process.env.SMTP_USER || 'eduone.africa@gmail.com',
        to: email,
        subject: `Welcome to ${schoolNameDisplay} - Account Details`,
        text: textContent,
      });
      success = true;
      messageId = info.messageId;
    }

    res.status(200).json({ success: true, messageId });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
