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
    const { email, parentName, studentName, admNumber, parentPin, schoolName } = req.body;

    if (!email || !studentName || !admNumber || !parentPin) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Require JWT authentication for staff/admin actions
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

    const schoolNameDisplay = schoolName || 'EduOne';
    const guardianNameDisplay = parentName || 'Parent / Guardian';

    const textContent = `Dear ${guardianNameDisplay},

This is an important message from ${schoolNameDisplay}.

To securely access your child's academic records, fees, and reports, you need to link their profile to your Parent Portal account.

Student Name: ${studentName}
Admission Number: ${admNumber}
Secure Parent Access PIN: ${parentPin}

Instructions:
1. Log in to the Parent Portal at https://www.edu1app.tech
2. If your account is not yet linked, you will be prompted to link a child.
3. Enter the Admission Number and the secure Parent Access PIN provided above.

If you have any questions or require assistance, please contact the school administration.

Best regards,
Administration
${schoolNameDisplay}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Parent Portal Access PIN</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; border: 1px solid #e9ecef;">
    <h2 style="color: #0052cc; margin-top: 0;">Parent Portal Access PIN</h2>
    <p>Dear ${guardianNameDisplay},</p>
    <p>This is an important message from <strong>${schoolNameDisplay}</strong>.</p>
    <p>To securely access your child's academic records, fee balances, and report cards, you need to link their profile to your Parent Portal account using the secure credentials below:</p>
    
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; border: 1px solid #dee2e6; margin: 25px 0;">
      <p style="margin: 8px 0; font-size: 15px;"><strong>Student Name:</strong> ${studentName}</p>
      <p style="margin: 8px 0; font-size: 15px;"><strong>Admission Number:</strong> <code style="background-color: #f1f3f5; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px;">${admNumber}</code></p>
      <p style="margin: 8px 0; font-size: 15px; margin-top: 15px; border-top: 1px solid #dee2e6; padding-top: 15px;"><strong>Parent Access PIN:</strong> <code style="background-color: #e6fcf5; color: #087f5b; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 16px; font-weight: bold;">${parentPin}</code></p>
    </div>
    
    <h3 style="color: #495057; font-size: 16px; margin-top: 25px;">How to Link Your Child:</h3>
    <ol style="color: #555555; padding-left: 20px;">
      <li style="margin-bottom: 8px;">Log in or Sign up to the Parent Portal at <a href="https://www.edu1app.tech" style="color: #0052cc; text-decoration: none;">https://www.edu1app.tech</a></li>
      <li style="margin-bottom: 8px;">If you haven't linked a student yet, the dashboard will prompt you to link your child's profile.</li>
      <li style="margin-bottom: 8px;">Enter the <strong>Admission Number</strong> and the <strong>Parent Access PIN</strong> exactly as shown above.</li>
    </ol>
    
    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 25px 0;" />
    
    <p style="font-size: 13px; color: #868e96; margin-bottom: 5px;">If you have any questions or require assistance, please contact the school administration.</p>
    <p style="font-size: 13px; color: #868e96; margin-top: 0;">Best regards,<br/>Administration, ${schoolNameDisplay}</p>
  </div>
</body>
</html>
`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.resend.com',
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'EduOne <noreply@edu1app.tech>',
      to: email,
      subject: \`Parent Access PIN - \${studentName}\`,
      text: textContent,
      html: htmlContent,
    });

    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending PIN email:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
