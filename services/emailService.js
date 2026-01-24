// backend/services/emailService.js
const nodemailer = require('nodemailer');
const { getPool } = require('../database/db');

// ============================================
// CONFIGURATION TRANSPORTEUR
// ============================================

let transporter;

const createTransporter = () => {
  const provider = process.env.EMAIL_PROVIDER || 'smtp';
  
  console.log('📧 Configuration Email Provider:', provider);

  switch (provider) {
    case 'smtp':
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

    case 'sendgrid':
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      });

    case 'mailgun':
      return nodemailer.createTransport({
        host: 'smtp.mailgun.org',
        port: 587,
        auth: {
          user: process.env.MAILGUN_SMTP_LOGIN,
          pass: process.env.MAILGUN_SMTP_PASSWORD,
        },
      });

    default:
      console.warn('⚠️ Provider email inconnu, utilisation SMTP par défaut');
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
  }
};

const initEmailService = () => {
  if (!transporter) {
    transporter = createTransporter();
    console.log('✅ Email Service initialisé');
  }
  return transporter;
};

// ============================================
// FONCTION PRINCIPALE : ENVOYER EMAIL
// ============================================

/**
 * Envoie un email et log dans la base de données
 * @param {Object} options - Options de l'email
 * @param {string} options.to - Email destinataire
 * @param {string} options.toName - Nom destinataire (optionnel)
 * @param {string} options.subject - Sujet de l'email
 * @param {string} options.html - Contenu HTML
 * @param {string} options.text - Contenu texte brut (optionnel)
 * @param {string} options.emailType - Type d'email pour logging
 * @param {string} options.userId - ID utilisateur (optionnel)
 * @param {Object} options.context - Contexte pour logging (optionnel)
 * @param {Object} options.variables - Variables utilisées dans le template (optionnel)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
const sendEmail = async ({
  to,
  toName,
  subject,
  html,
  text,
  emailType,
  userId = null,
  context = {},
  variables = {},
  replyTo = null,
  attachments = []
}) => {
  const pool = getPool();
  const provider = process.env.EMAIL_PROVIDER || 'smtp';
  
  // Vérifier configuration
  if (!transporter) {
    initEmailService();
  }

  // Mode preview (dev) : ouvrir dans navigateur au lieu d'envoyer
  if (process.env.EMAIL_PREVIEW_MODE === 'true') {
    console.log('📧 [PREVIEW MODE] Email:', {
      to,
      subject,
      emailType
    });
    // Logique preview à implémenter si besoin (nodemailer preview)
  }

  // Mode test : rediriger vers email de test
  const finalTo = process.env.NODE_ENV === 'development' && process.env.EMAIL_TEST_RECIPIENT
    ? process.env.EMAIL_TEST_RECIPIENT
    : to;

  const emailOptions = {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'LE SAGE DEV',
      address: process.env.EMAIL_FROM_ADDRESS || 'noreply@lesagedev.com'
    },
    to: finalTo,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML si pas de texte fourni
    replyTo: replyTo || process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM_ADDRESS,
    attachments
  };

  // Log de l'email en BDD (AVANT envoi)
  let logId;
  try {
    const logResult = await pool.query(`
      INSERT INTO email_logs (
        recipient_email,
        recipient_name,
        user_id,
        email_type,
        subject,
        context,
        variables,
        status,
        provider
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      to,
      toName,
      userId,
      emailType,
      subject,
      JSON.stringify(context),
      JSON.stringify(variables),
      'pending',
      provider
    ]);
    
    logId = logResult.rows[0].id;
  } catch (error) {
    console.error('❌ Erreur log email en BDD:', error.message);
    // Continue quand même l'envoi
  }

  // Envoi de l'email
  try {
    console.log(`📧 Envoi email: ${emailType} → ${to}`);
    
    const info = await transporter.sendMail(emailOptions);
    
    console.log('✅ Email envoyé:', info.messageId);

    // Mise à jour du log : succès
    if (logId) {
      await pool.query(`
        UPDATE email_logs 
        SET status = 'sent',
            sent_at = CURRENT_TIMESTAMP,
            provider_message_id = $1
        WHERE id = $2
      `, [info.messageId, logId]);
    }

    return {
      success: true,
      messageId: info.messageId,
      logId
    };

  } catch (error) {
    console.error('❌ Erreur envoi email:', error.message);

    // Mise à jour du log : échec
    if (logId) {
      await pool.query(`
        UPDATE email_logs 
        SET status = 'failed',
            error_message = $1
        WHERE id = $2
      `, [error.message, logId]);
    }

    // Retry logic (optionnel)
    const maxRetries = parseInt(process.env.EMAIL_RETRY_ATTEMPTS) || 3;
    // TODO: Implémenter retry avec délai exponentiel

    return {
      success: false,
      error: error.message,
      logId
    };
  }
};

// ============================================
// HELPERS : VÉRIFICATIONS
// ============================================

/**
 * Vérifier si l'utilisateur accepte ce type d'email
 */
const checkUserEmailPreferences = async (userId, emailType) => {
  const pool = getPool();
  
  try {
    const result = await pool.query(`
      SELECT 
        email_notifications,
        reservation_confirmations,
        reservation_reminders,
        project_updates,
        project_status_changes,
        payment_notifications,
        newsletter
      FROM email_preferences
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      // Pas de préférences = accepte tout par défaut
      return true;
    }

    const prefs = result.rows[0];

    // Désactivation globale
    if (!prefs.email_notifications) {
      return false;
    }

    // Vérifier préférence spécifique selon type d'email
    const typeMapping = {
      'reservation_created': 'reservation_confirmations',
      'reservation_confirmed': 'reservation_confirmations',
      'reservation_cancelled': 'reservation_confirmations',
      'reservation_reminder': 'reservation_reminders',
      'project_created': 'project_updates',
      'project_updated': 'project_updates',
      'project_status_changed': 'project_status_changes',
      'project_delivered': 'project_updates',
      'payment_success': 'payment_notifications',
      'payment_failed': 'payment_notifications',
      'newsletter': 'newsletter'
    };

    const prefKey = typeMapping[emailType];
    if (prefKey && prefs[prefKey] !== undefined) {
      return prefs[prefKey];
    }

    // Type non mappé = autoriser par défaut
    return true;

  } catch (error) {
    console.error('Erreur vérification préférences email:', error);
    // En cas d'erreur, autoriser l'envoi
    return true;
  }
};

/**
 * Vérifier la limite de taux (rate limiting)
 */
const checkRateLimit = async () => {
  const pool = getPool();
  const limit = parseInt(process.env.EMAIL_RATE_LIMIT) || 100;
  
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM email_logs
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
    `);

    const count = parseInt(result.rows[0].count);
    
    if (count >= limit) {
      console.warn(`⚠️ Rate limit atteint: ${count}/${limit} emails/heure`);
      return false;
    }

    return true;

  } catch (error) {
    console.error('Erreur vérification rate limit:', error);
    return true; // En cas d'erreur, autoriser
  }
};

// ============================================
// STATISTIQUES
// ============================================

/**
 * Récupérer les stats d'emails
 */
const getEmailStats = async (options = {}) => {
  const pool = getPool();
  const { startDate, endDate, emailType } = options;

  try {
    let query = `
      SELECT 
        email_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'opened') as opened,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced
      FROM email_logs
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    if (emailType) {
      query += ` AND email_type = $${paramCount}`;
      params.push(emailType);
      paramCount++;
    }

    query += ` GROUP BY email_type ORDER BY total DESC`;

    const result = await pool.query(query, params);
    return result.rows;

  } catch (error) {
    console.error('Erreur récupération stats emails:', error);
    return [];
  }
};

/**
 * Récupérer l'historique des emails d'un utilisateur
 */
const getUserEmailHistory = async (userId, limit = 50) => {
  const pool = getPool();

  try {
    const result = await pool.query(`
      SELECT 
        id,
        email_type,
        subject,
        recipient_email,
        status,
        sent_at,
        opened_at,
        created_at
      FROM email_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);

    return result.rows;

  } catch (error) {
    console.error('Erreur récupération historique emails:', error);
    return [];
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  initEmailService,
  sendEmail,
  checkUserEmailPreferences,
  checkRateLimit,
  getEmailStats,
  getUserEmailHistory
};