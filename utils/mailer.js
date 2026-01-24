// backend/utils/mailer.js
const nodemailer = require('nodemailer');

// Configuration SMTP (à adapter selon votre service)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Fonction d'envoi email
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"LE SAGE DEV" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('✅ Email envoyé:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    return { success: false, error: error.message };
  }
};

// Template réponse contact
const sendContactReply = async (to, name, subject, replyText) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0066FF, #00D9FF); padding: 30px; text-align: center; color: white; }
        .content { background: #f9f9f9; padding: 30px; }
        .reply { background: white; padding: 20px; border-left: 4px solid #0066FF; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LE SAGE DEV</h1>
          <p>Réponse à votre message</p>
        </div>
        <div class="content">
          <p>Bonjour ${name},</p>
          <p>Nous avons bien reçu votre message concernant : <strong>${subject}</strong></p>
          <div class="reply">
            <p><strong>Notre réponse :</strong></p>
            <p>${replyText.replace(/\n/g, '<br>')}</p>
          </div>
          <p>Si vous avez d'autres questions, n'hésitez pas à nous contacter.</p>
          <p>Cordialement,<br>L'équipe LE SAGE DEV</p>
        </div>
        <div class="footer">
          <p>© 2025 LE SAGE DEV - Agence Web</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `Re: ${subject}`,
    html,
    text: `Bonjour ${name},\n\n${replyText}\n\nCordialement,\nLE SAGE DEV`,
  });
};

module.exports = { sendEmail, sendContactReply };