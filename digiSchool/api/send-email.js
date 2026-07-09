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
    const { email, username, password, name, role, schoolName, parentPin, activationPin, studentName } = req.body;

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
      
      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Server misconfiguration: missing Supabase credentials' });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }
    }


    const roleDisplay = isParent ? 'Parent Portal' : 'Staff/Teacher';
    const schoolNameDisplay = schoolName || 'EduOne';

    const textContent = `Dear ${name},

Welcome to ${schoolNameDisplay}! 

Your ${roleDisplay} account has been successfully provisioned. 
Please find your secure login credentials below:

Portal URL: https://www.edu1app.tech
${username ? `Login Username: ${username}` : `Login Email: ${email}`}
Temporary Password: ${password}
${isParent && parentPin ? `
Parent Access PIN: ${parentPin}
(Please use this PIN along with your child's Admission Number to link their profile)` : ''}
${!isParent && activationPin ? `
Account Activation PIN: ${activationPin}
(You will be prompted to enter this PIN upon your first login to activate your account)` : ''}

Please log in at your earliest convenience to access your dashboard. We highly recommend changing your password upon your first login to maintain account security.

If you have any questions or require assistance, please contact the school administration.

Best regards,
Administration
${schoolNameDisplay}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Account Credentials</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; border: 1px solid #e9ecef;">
    <h2 style="color: #0052cc; margin-top: 0;">Welcome to ${schoolNameDisplay}!</h2>
    <p>Dear ${name},</p>
    <p>Your <strong>${roleDisplay}</strong> account has been successfully provisioned. Please find your secure login credentials below:</p>
    
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; border: 1px solid #dee2e6; margin: 25px 0;">
      <p style="margin: 8px 0; font-size: 15px;"><strong>Portal URL:</strong> <a href="https://www.edu1app.tech" style="color: #0052cc; text-decoration: none;">https://www.edu1app.tech</a></p>
      <p style="margin: 8px 0; font-size: 15px;"><strong>${username ? 'Login Username' : 'Login Email'}:</strong> ${username ? username : email}</p>
      <p style="margin: 8px 0; font-size: 15px;"><strong>Temporary Password:</strong> <code style="background-color: #f1f3f5; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px;">${password}</code></p>
      ${isParent && parentPin ? `<p style="margin: 8px 0; font-size: 15px; margin-top: 15px; border-top: 1px solid #dee2e6; padding-top: 15px;"><strong>Parent Access PIN:</strong> <code style="background-color: #e6fcf5; color: #087f5b; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 16px; font-weight: bold;">${parentPin}</code><br/><span style="font-size: 13px; color: #666;">(Use this PIN along with your child's Admission Number to link ${studentName || 'their profile'})</span></p>` : ''}
      ${!isParent && activationPin ? `<p style="margin: 8px 0; font-size: 15px; margin-top: 15px; border-top: 1px solid #dee2e6; padding-top: 15px;"><strong>Account Activation PIN:</strong> <code style="background-color: #e6fcf5; color: #087f5b; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 16px; font-weight: bold;">${activationPin}</code><br/><span style="font-size: 13px; color: #666;">(You will be prompted to enter this PIN upon your first login to activate your account)</span></p>` : ''}
    </div>
    
    <p style="font-size: 14px; color: #555555;">Please log in at your earliest convenience to access your dashboard. We highly recommend changing your password upon your first login to maintain account security.</p>
    
    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 25px 0;" />
    
    <p style="font-size: 13px; color: #868e96; margin-bottom: 5px;">If you have any questions or require assistance, please contact the school administration.</p>
    <p style="font-size: 13px; color: #868e96; margin-top: 0;">Best regards,<br/>Administration, ${schoolNameDisplay}</p>
  </div>
</body>
</html>
`;

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
      html: htmlContent,
    });

    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
