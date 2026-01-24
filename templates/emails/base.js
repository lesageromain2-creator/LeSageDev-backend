// backend/templates/emails/base.js
// Template HTML de base pour tous les emails

/**
 * Génère le HTML de base pour un email
 * @param {Object} options
 * @param {string} options.title - Titre de l'email
 * @param {string} options.preheader - Texte de prévisualisation
 * @param {string} options.content - Contenu HTML principal
 * @param {Object} options.variables - Variables dynamiques (firstname, etc.)
 * @returns {string} HTML complet de l'email
 */
const generateBaseEmailHTML = ({ title, preheader, content, variables = {} }) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const currentYear = new Date().getFullYear();
  
    return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${title}</title>
    <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
    </style>
    <![endif]-->
    <style>
      /* Reset styles */
      body {
        margin: 0;
        padding: 0;
        min-width: 100%;
        width: 100% !important;
        height: 100% !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      
      body, table, td, p, a, li, blockquote {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      
      table, td {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }
      
      img {
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
        -ms-interpolation-mode: bicubic;
      }
      
      /* Styles globaux */
      .email-container {
        max-width: 600px;
        margin: 0 auto;
      }
      
      .header {
        background: linear-gradient(135deg, #0A0E27 0%, #1a1f3a 100%);
        padding: 40px 20px;
        text-align: center;
      }
      
      .logo {
        font-size: 28px;
        font-weight: 800;
        color: white;
        margin: 0;
        background: linear-gradient(135deg, #00D9FF, #0066FF);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      .content {
        background: white;
        padding: 40px 30px;
      }
      
      .content h1 {
        font-size: 24px;
        font-weight: 700;
        color: #0A0E27;
        margin: 0 0 20px 0;
      }
      
      .content p {
        font-size: 16px;
        line-height: 1.6;
        color: #333;
        margin: 0 0 16px 0;
      }
      
      .button {
        display: inline-block;
        padding: 14px 28px;
        background: linear-gradient(135deg, #0066FF, #00D9FF);
        color: white !important;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 16px;
        margin: 20px 0;
      }
      
      .info-box {
        background: #f5f7fa;
        border-left: 4px solid #0066FF;
        padding: 20px;
        margin: 20px 0;
        border-radius: 4px;
      }
      
      .info-box p {
        margin: 8px 0;
        font-size: 14px;
      }
      
      .info-box strong {
        color: #0A0E27;
        font-weight: 600;
      }
      
      .footer {
        background: #f5f7fa;
        padding: 30px 20px;
        text-align: center;
        font-size: 14px;
        color: #666;
      }
      
      .footer a {
        color: #0066FF;
        text-decoration: none;
      }
      
      .footer .social-links {
        margin: 20px 0;
      }
      
      .footer .social-links a {
        display: inline-block;
        margin: 0 10px;
        color: #666;
        text-decoration: none;
      }
      
      .divider {
        height: 1px;
        background: #e0e0e0;
        margin: 30px 0;
      }
      
      /* Responsive */
      @media only screen and (max-width: 600px) {
        .email-container {
          width: 100% !important;
        }
        
        .content {
          padding: 30px 20px !important;
        }
        
        .content h1 {
          font-size: 22px !important;
        }
        
        .button {
          display: block !important;
          width: 100% !important;
          box-sizing: border-box;
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f7fa;">
    
    <!-- Preheader text -->
    <div style="display: none; max-height: 0; overflow: hidden;">
      ${preheader}
    </div>
    
    <!-- Email Container -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa;">
      <tr>
        <td align="center" style="padding: 20px 0;">
          
          <!-- Main Content Table -->
          <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <tr>
              <td class="header" style="background: linear-gradient(135deg, #0A0E27 0%, #1a1f3a 100%); padding: 40px 20px; text-align: center;">
                <h1 class="logo" style="font-size: 28px; font-weight: 800; color: white; margin: 0;">
                  LE SAGE DEV
                </h1>
                <p style="color: rgba(255, 255, 255, 0.7); margin: 8px 0 0 0; font-size: 14px;">
                  Web Development & Digital Solutions
                </p>
              </td>
            </tr>
            
            <!-- Content -->
            <tr>
              <td class="content" style="padding: 40px 30px;">
                ${content}
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td class="footer" style="background: #f5f7fa; padding: 30px 20px; text-align: center; font-size: 14px; color: #666;">
                
                <div class="social-links" style="margin: 20px 0;">
                  <a href="https://linkedin.com/company/lesagedev" style="color: #666; text-decoration: none; margin: 0 10px;">LinkedIn</a>
                  <span style="color: #ccc;">•</span>
                  <a href="https://github.com/lesagedev" style="color: #666; text-decoration: none; margin: 0 10px;">GitHub</a>
                  <span style="color: #ccc;">•</span>
                  <a href="${frontendUrl}/portfolio" style="color: #666; text-decoration: none; margin: 0 10px;">Portfolio</a>
                </div>
                
                <div class="divider" style="height: 1px; background: #e0e0e0; margin: 30px 0;"></div>
                
                <p style="margin: 8px 0; font-size: 14px; color: #666;">
                  <strong>LE SAGE DEV</strong><br>
                  Développement Web Professionnel<br>
                  <a href="mailto:contact@lesagedev.com" style="color: #0066FF; text-decoration: none;">contact@lesagedev.com</a>
                </p>
                
                <p style="margin: 16px 0 8px 0; font-size: 12px; color: #999;">
                  © ${currentYear} LE SAGE DEV. Tous droits réservés.
                </p>
                
                <p style="margin: 8px 0; font-size: 12px; color: #999;">
                  <a href="${frontendUrl}/preferences" style="color: #0066FF; text-decoration: none;">Gérer mes préférences</a>
                  <span style="color: #ccc;"> • </span>
                  <a href="${frontendUrl}/unsubscribe" style="color: #999; text-decoration: none;">Se désabonner</a>
                </p>
                
              </td>
            </tr>
            
          </table>
          
        </td>
      </tr>
    </table>
    
  </body>
  </html>
    `.trim();
  };
  
  /**
   * Remplace les variables dans un template
   * @param {string} template - Template avec {{variable}}
   * @param {Object} variables - Objet contenant les valeurs
   * @returns {string} Template avec variables remplacées
   */
  const replaceVariables = (template, variables = {}) => {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    }
    
    return result;
  };
  
  /**
   * Helper : bouton CTA
   */
  const createButton = (text, url) => {
    return `
      <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr>
          <td align="center">
            <a href="${url}" class="button" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0066FF, #00D9FF); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              ${text}
            </a>
          </td>
        </tr>
      </table>
    `;
  };
  
  /**
   * Helper : boîte d'information
   */
  const createInfoBox = (items) => {
    const itemsHTML = items.map(({ label, value }) => `
      <p style="margin: 8px 0; font-size: 14px;">
        <strong style="color: #0A0E27; font-weight: 600;">${label}:</strong> ${value}
      </p>
    `).join('');
  
    return `
      <div class="info-box" style="background: #f5f7fa; border-left: 4px solid #0066FF; padding: 20px; margin: 20px 0; border-radius: 4px;">
        ${itemsHTML}
      </div>
    `;
  };
  
  /**
   * Helper : séparateur
   */
  const createDivider = () => {
    return `<div class="divider" style="height: 1px; background: #e0e0e0; margin: 30px 0;"></div>`;
  };
  
  module.exports = {
    generateBaseEmailHTML,
    replaceVariables,
    createButton,
    createInfoBox,
    createDivider
  };