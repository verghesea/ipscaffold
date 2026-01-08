import sgMail from '@sendgrid/mail';

const apiKey = process.env.SENDGRID_API_KEY || '';
if (apiKey) {
  sgMail.setApiKey(apiKey);
}

export async function sendMagicLinkEmail(
  email: string,
  token: string,
  patentTitle: string
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  const magicLink = `${appUrl}/auth/verify/${token}`;
  
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@ipscaffold.com',
    subject: 'Access Your IP Scaffold Analysis',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Work Sans', Arial, sans-serif; line-height: 1.6; color: #1C1917; background-color: #FFFEF9; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; padding: 0 20px; }
            .header { background: linear-gradient(135deg, #0A1F3D 0%, #1E446B 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; margin: 0; }
            .content { background: white; padding: 40px 30px; border: 1px solid #E7E5E4; }
            .button { display: inline-block; background: #B8860B; color: white; text-decoration: none; padding: 14px 32px; font-weight: 600; margin: 20px 0; }
            .button:hover { background: #D4A528; }
            .footer { text-align: center; padding: 20px; color: #78716C; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>IP Scaffold</h1>
            </div>
            <div class="content">
              <h2 style="color: #0A1F3D; font-family: 'Playfair Display', Georgia, serif;">Your Analysis is Ready</h2>
              <p>Click the button below to access your complete analysis for:</p>
              <p style="background: #F8F7F2; padding: 15px; border-left: 4px solid #B8860B;"><strong>${patentTitle}</strong></p>
              <p>This link will log you in and take you directly to your dashboard where you can view all three generated artifacts:</p>
              <ul>
                <li><strong>ELIA15</strong> - Simplified explanation</li>
                <li><strong>Business Narrative</strong> - Investor-ready content</li>
                <li><strong>Golden Circle</strong> - Strategic framework</li>
              </ul>
              <center>
                <a href="${magicLink}" class="button">Access Dashboard →</a>
              </center>
              <p style="color: #78716C; font-size: 14px; margin-top: 30px;">This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              © ${new Date().getFullYear()} IP Scaffold. All rights reserved.
            </div>
          </div>
        </body>
      </html>
    `,
  };
  
  if (!apiKey) {
    console.log('SendGrid not configured. Magic link would be:', magicLink);
    return;
  }
  
  await sgMail.send(msg);
}
