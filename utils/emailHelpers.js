// backend/utils/emailHelpers.js
const { sendEmail, checkUserEmailPreferences } = require('../services/emailService');
const emailTemplates = require('../templates/emails');

// ============================================
// HELPERS : ENVOI FACILE D'EMAILS
// ============================================

/**
 * Envoyer email de bienvenue
 */
const sendWelcomeEmail = async (user) => {
  try {
    const html = emailTemplates.welcomeEmail({
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email
    });

    const result = await sendEmail({
      to: user.email,
      toName: `${user.firstname} ${user.lastname}`,
      subject: 'Bienvenue sur LE SAGE DEV 🚀',
      html,
      emailType: 'welcome',
      userId: user.id,
      context: { user_id: user.id },
      variables: { firstname: user.firstname, email: user.email }
    });

    console.log('✅ Email bienvenue envoyé:', user.email);
    return result;

  } catch (error) {
    console.error('❌ Erreur envoi email bienvenue:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer email réservation créée
 */
const sendReservationCreatedEmail = async (reservation, user) => {
  try {
    // Vérifier préférences
    const canSend = await checkUserEmailPreferences(user.id, 'reservation_created');
    if (!canSend) {
      console.log('⏭️ Email réservation ignoré (préférences utilisateur)');
      return { success: false, reason: 'user_preferences' };
    }

    const html = emailTemplates.reservationCreatedEmail({
      firstname: user.firstname,
      reservation_date: reservation.reservation_date,
      reservation_time: reservation.reservation_time,
      meeting_type: reservation.meeting_type,
      project_type: reservation.project_type,
      reservation_id: reservation.id
    });

    const result = await sendEmail({
      to: user.email,
      toName: `${user.firstname} ${user.lastname}`,
      subject: `Rendez-vous enregistré - ${new Date(reservation.reservation_date).toLocaleDateString('fr-FR')}`,
      html,
      emailType: 'reservation_created',
      userId: user.id,
      context: { reservation_id: reservation.id },
      variables: {
        firstname: user.firstname,
        reservation_date: reservation.reservation_date,
        reservation_time: reservation.reservation_time
      }
    });

    console.log('✅ Email réservation créée envoyé:', user.email);
    return result;

  } catch (error) {
    console.error('❌ Erreur envoi email réservation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer email réservation confirmée
 */
const sendReservationConfirmedEmail = async (reservation, user) => {
  try {
    const canSend = await checkUserEmailPreferences(user.id, 'reservation_confirmed');
    if (!canSend) {
      console.log('⏭️ Email confirmation ignoré (préférences)');
      return { success: false, reason: 'user_preferences' };
    }

    const html = emailTemplates.reservationConfirmedEmail({
      firstname: user.firstname,
      reservation_date: reservation.reservation_date,
      reservation_time: reservation.reservation_time,
      meeting_type: reservation.meeting_type,
      meeting_link: reservation.meeting_link || null
    });

    const result = await sendEmail({
      to: user.email,
      toName: `${user.firstname} ${user.lastname}`,
      subject: `✅ Rendez-vous confirmé - ${new Date(reservation.reservation_date).toLocaleDateString('fr-FR')}`,
      html,
      emailType: 'reservation_confirmed',
      userId: user.id,
      context: { reservation_id: reservation.id },
      variables: {
        firstname: user.firstname,
        reservation_date: reservation.reservation_date
      }
    });

    console.log('✅ Email réservation confirmée envoyé:', user.email);
    return result;

  } catch (error) {
    console.error('❌ Erreur envoi email confirmation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer email réservation annulée
 */
const sendReservationCancelledEmail = async (reservation, user) => {
  try {
    const html = emailTemplates.reservationCancelledEmail({
      firstname: user.firstname,
      reservation_date: reservation.reservation_date,
      cancellation_reason: reservation.cancellation_reason || null
    });

    const result = await sendEmail({
      to: user.email,
      toName: `${user.firstname} ${user.lastname}`,
      subject: `Rendez-vous annulé - ${new Date(reservation.reservation_date).toLocaleDateString('fr-FR')}`,
      html,
      emailType: 'reservation_cancelled',
      userId: user.id,
      context: { reservation_id: reservation.id },
      variables: {
        firstname: user.firstname,
        reservation_date: reservation.reservation_date
      }
    });

    console.log('✅ Email annulation envoyé:', user.email);
    return result;

  } catch (error) {
    console.error('❌ Erreur envoi email annulation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer email projet créé
 */
const sendProjectCreatedEmail = async (project, user) => {
  try {
    const canSend = await checkUserEmailPreferences(user.id, 'project_created');
    if (!canSend) {
      console.log('⏭️ Email projet ignoré (préférences)');
      return { success: false, reason: 'user_preferences' };
    }

    const html = emailTemplates.projectCreatedEmail({
      firstname: user.firstname,
      project_title: project.title,
      project_type: project.project_type,
      start_date: project.start_date
    });

    const result = await sendEmail({
      to: user.email,
      toName: `${user.firstname} ${user.lastname}`,
      subject: `Votre projet "${project.title}" est lancé 🚀`,
      html,
      emailType: 'project_created',
      userId: user.id,
      context: { project_id: project.id },
      variables: {
        firstname: user.firstname,
        project_title: project.title
      }
    });

    console.log('✅ Email projet créé envoyé:', user.email);
    return result;

  } catch (error) {
    console.error('❌ Erreur envoi email projet:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer email mise à jour projet
 */
const sendProjectUpdateEmail = async (project, user, update) => {
  try {
    const canSend = await checkUserEmailPreferences(user.id, 'project_updated');
    if (!canSend) {
      console.log('⏭️ Email update projet ignoré (préférences)');
      return { success: false, reason: 'user_preferences' };
    }

    const html = emailTemplates.projectUpdatedEmail({
      firstname: user.firstname,
      project_title: project.title,
      update_type: update.update_type || 'info',
      update_message: update.message,
      project_id: project.id
    });

    const result = await sendEmail({
      to: user.email,
      toName: `${user.firstname} ${user.lastname}`,
      subject: `Mise à jour : ${project.title}`,
      html,
      emailType: 'project_updated',
      userId: user.id,
      context: { 
        project_id: project.id,
        update_id: update.id 
      },
      variables: {
        firstname: user.firstname,
        project_title: project.title,
        update_message: update.message
      }
    });

    console.log('✅ Email update projet envoyé:', user.email);
    return result;

  } catch (error) {
    console.error('❌ Erreur envoi email update projet:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer email message contact reçu (pour admin)
 */
const sendContactMessageReceivedEmail = async (message) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM_ADDRESS;
    
    const html = emailTemplates.contactMessageReceivedEmail({
      name: message.name,
      email: message.email,
      subject: message.subject,
      message: message.message,
      message_id: message.id
    });

    const result = await sendEmail({
      to: adminEmail,
      toName: 'Admin LE SAGE DEV',
      subject: `🔔 Nouveau message : ${message.subject}`,
      html,
      emailType: 'contact_received',
      userId: null,
      context: { message_id: message.id },
      variables: {
        name: message.name,
        subject: message.subject
      },
      replyTo: message.email
    });

    console.log('✅ Email contact admin envoyé');
    return result;

  } catch (error) {
    console.error('❌ Erreur envoi email contact admin:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer email réponse à un message (pour client)
 */
const sendContactReplyEmail = async (message, reply, admin) => {
  try {
    const html = emailTemplates.contactReplyEmail({
      firstname: message.name.split(' ')[0],
      original_message: message.message,
      reply_message: reply.reply_text,
      admin_name: admin ? `${admin.firstname} ${admin.lastname}` : 'LE SAGE DEV'
    });

    const result = await sendEmail({
      to: message.email,
      toName: message.name,
      subject: `Re: ${message.subject}`,
      html,
      emailType: 'contact_reply',
      userId: null,
      context: { 
        message_id: message.id,
        reply_id: reply.id 
      },
      variables: {
        firstname: message.name.split(' ')[0],
        admin_name: admin ? `${admin.firstname} ${admin.lastname}` : 'LE SAGE DEV'
      },
      replyTo: admin?.email || process.env.EMAIL_FROM_ADDRESS
    });

    console.log('✅ Email réponse contact envoyé:', message.email);
    return result;

  } catch (error) {
    console.error('❌ Erreur envoi email réponse contact:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer email reset password
 */
const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const html = emailTemplates.passwordResetEmail({
      firstname: user.firstname,
      reset_link: resetLink,
      expires_in: '1 heure'
    });

    const result = await sendEmail({
      to: user.email,
      toName: `${user.firstname} ${user.lastname}`,
      subject: 'Réinitialisation de votre mot de passe',
      html,
      emailType: 'password_reset',
      userId: user.id,
      context: { user_id: user.id },
      variables: {
        firstname: user.firstname
      }
    });

    console.log('✅ Email reset password envoyé:', user.email);
    return result;

  } catch (error) {
    console.error('❌ Erreur envoi email reset password:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// HELPER : BATCH EMAILS (envoi multiple)
// ============================================

/**
 * Envoyer un email à plusieurs destinataires (newsletter, etc.)
 */
const sendBatchEmails = async (recipients, emailData) => {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const recipient of recipients) {
    try {
      await sendEmail({
        ...emailData,
        to: recipient.email,
        toName: recipient.name || recipient.email,
        userId: recipient.id || null
      });
      
      results.success++;
      
      // Petit délai pour éviter rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Erreur envoi à ${recipient.email}:`, error.message);
      results.failed++;
      results.errors.push({
        email: recipient.email,
        error: error.message
      });
    }
  }

  console.log(`📊 Batch emails: ${results.success} réussis, ${results.failed} échoués`);
  return results;
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  sendWelcomeEmail,
  sendReservationCreatedEmail,
  sendReservationConfirmedEmail,
  sendReservationCancelledEmail,
  sendProjectCreatedEmail,
  sendProjectUpdateEmail,
  sendContactMessageReceivedEmail,
  sendContactReplyEmail,
  sendPasswordResetEmail,
  sendBatchEmails
};