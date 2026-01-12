import sgMail from '@sendgrid/mail';

const apiKey = process.env.SENDGRID_API_KEY || '';
if (apiKey) {
  sgMail.setApiKey(apiKey);
}

export async function sendWelcomeEmail(
  email: string
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@ipscaffold.com',
    subject: 'Welcome to IP Scaffold',
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
              <h2 style="color: #0A1F3D; font-family: 'Playfair Display', Georgia, serif;">Welcome to IP Scaffold!</h2>
              <p>Thank you for joining IP Scaffold. You now have access to transform your patents into business-ready artifacts.</p>
              <p>Your account includes <strong>100 free credits</strong> to get started. Each patent analysis uses 10 credits.</p>
              <p>With IP Scaffold, you can generate:</p>
              <ul>
                <li><strong>ELIA15</strong> - Simplified explanation anyone can understand</li>
                <li><strong>Business Narrative</strong> - Investor-ready pitch content</li>
                <li><strong>Golden Circle</strong> - Strategic WHY/HOW/WHAT framework</li>
              </ul>
              <center>
                <a href="${appUrl}/dashboard" class="button">Go to Dashboard →</a>
              </center>
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
    console.log('SendGrid not configured. Welcome email would be sent to:', email);
    return;
  }
  
  await sgMail.send(msg);
}

export async function sendAnalysisCompleteEmail(
  email: string,
  patentTitle: string
): Promise<void> {
  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@ipscaffold.com',
    subject: 'Your Patent Analysis is Complete',
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
              <p>Great news! The analysis for your patent has been completed:</p>
              <p style="background: #F8F7F2; padding: 15px; border-left: 4px solid #B8860B;"><strong>${patentTitle}</strong></p>
              <p>You can now view all three generated artifacts:</p>
              <ul>
                <li><strong>ELIA15</strong> - Simplified explanation</li>
                <li><strong>Business Narrative</strong> - Investor-ready content</li>
                <li><strong>Golden Circle</strong> - Strategic framework</li>
              </ul>
              <center>
                <a href="${appUrl}/dashboard" class="button">View Your Analysis →</a>
              </center>
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
    console.log('SendGrid not configured. Analysis complete email would be sent to:', email);
    return;
  }
  
  await sgMail.send(msg);
}
