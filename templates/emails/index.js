// backend/templates/emails/index.js
const { 
    generateBaseEmailHTML, 
    replaceVariables,
    createButton,
    createInfoBox,
    createDivider
  } = require('./base');
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  // ============================================
  // 1. EMAIL DE BIENVENUE
  // ============================================
  
  const welcomeEmail = (variables) => {
    const { firstname, email } = variables;
    
    const content = `
      <h1>Bienvenue ${firstname} ! 🚀</h1>
      
      <p>Merci d'avoir rejoint <strong>LE SAGE DEV</strong>, votre partenaire pour la création de solutions web sur mesure.</p>
      
      <p>Votre compte a été créé avec succès. Vous pouvez dès maintenant :</p>
      
      <ul style="line-height: 1.8; color: #333;">
        <li>📅 Réserver un rendez-vous découverte gratuit</li>
        <li>💼 Découvrir nos offres et services</li>
        <li>📂 Consulter notre portfolio de projets</li>
        <li>📧 Nous contacter pour discuter de votre projet</li>
      </ul>
      
      ${createButton('Accéder à mon espace', `${frontendUrl}/dashboard`)}
      
      ${createDivider()}
      
      <p><strong>Vous avez un projet en tête ?</strong></p>
      <p>Réservez dès maintenant un appel découverte de 30 minutes pour discuter de vos besoins.</p>
      
      ${createButton('Réserver un rendez-vous', `${frontendUrl}/reservation`)}
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Si vous avez des questions, n'hésitez pas à nous contacter à 
        <a href="mailto:contact@lesagedev.com" style="color: #0066FF;">contact@lesagedev.com</a>
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Bienvenue sur LE SAGE DEV',
      preheader: 'Votre compte a été créé avec succès',
      content,
      variables
    });
  };
  
  // ============================================
  // 2. RÉSERVATION CRÉÉE
  // ============================================
  
  const reservationCreatedEmail = (variables) => {
    const { 
      firstname, 
      reservation_date, 
      reservation_time, 
      meeting_type,
      project_type,
      reservation_id 
    } = variables;
    
    const meetingTypeLabel = meeting_type === 'visio' ? '🎥 Visioconférence' : '🏢 Présentiel';
    
    const content = `
      <h1>Votre rendez-vous est enregistré ! 📅</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Votre demande de rendez-vous a bien été enregistrée. Nous allons la confirmer dans les plus brefs délais.</p>
      
      ${createInfoBox([
        { label: 'Date', value: new Date(reservation_date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
        { label: 'Heure', value: reservation_time },
        { label: 'Type de rendez-vous', value: meetingTypeLabel },
        { label: 'Type de projet', value: project_type || 'À définir' }
      ])}
      
      <p><strong>Prochaines étapes :</strong></p>
      <ol style="line-height: 1.8; color: #333;">
        <li>Nous confirmons votre rendez-vous (vous recevrez un email)</li>
        <li>Vous recevrez un lien de visioconférence (si applicable)</li>
        <li>Nous discutons de votre projet en détail</li>
        <li>Nous établissons un devis personnalisé</li>
      </ol>
      
      ${createButton('Voir ma réservation', `${frontendUrl}/dashboard#reservations`)}
      
      ${createDivider()}
      
      <p style="font-size: 14px; color: #666;">
        <strong>Besoin de modifier ou d'annuler ?</strong><br>
        Vous pouvez gérer votre réservation depuis votre espace personnel.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Rendez-vous enregistré - LE SAGE DEV',
      preheader: `Votre rendez-vous du ${reservation_date} à ${reservation_time}`,
      content,
      variables
    });
  };
  
  // ============================================
  // 3. RÉSERVATION CONFIRMÉE
  // ============================================
  
  const reservationConfirmedEmail = (variables) => {
    const { 
      firstname, 
      reservation_date, 
      reservation_time, 
      meeting_type,
      meeting_link 
    } = variables;
    
    const meetingTypeLabel = meeting_type === 'visio' ? '🎥 Visioconférence' : '🏢 Présentiel';
    
    const content = `
      <h1>Rendez-vous confirmé ! ✅</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Bonne nouvelle ! Votre rendez-vous a été <strong>confirmé</strong>.</p>
      
      ${createInfoBox([
        { label: 'Date', value: new Date(reservation_date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
        { label: 'Heure', value: reservation_time },
        { label: 'Type', value: meetingTypeLabel }
      ])}
      
      ${meeting_type === 'visio' && meeting_link ? `
        <p><strong>Lien de visioconférence :</strong></p>
        ${createButton('Rejoindre la visio', meeting_link)}
        <p style="font-size: 14px; color: #666;">
          💡 Vous pouvez vous connecter 5 minutes avant l'heure prévue.
        </p>
      ` : ''}
      
      ${createDivider()}
      
      <p><strong>Pour préparer notre échange :</strong></p>
      <ul style="line-height: 1.8; color: #333;">
        <li>Préparez une liste de vos besoins et objectifs</li>
        <li>Si vous avez des références visuelles, n'hésitez pas</li>
        <li>Pensez à votre budget et vos délais</li>
      </ul>
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        <strong>Un empêchement ?</strong><br>
        Prévenez-nous au plus vite à 
        <a href="mailto:contact@lesagedev.com" style="color: #0066FF;">contact@lesagedev.com</a>
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Rendez-vous confirmé - LE SAGE DEV',
      preheader: `Votre RDV du ${reservation_date} est confirmé`,
      content,
      variables
    });
  };
  
  // ============================================
  // 4. RÉSERVATION ANNULÉE
  // ============================================
  
  const reservationCancelledEmail = (variables) => {
    const { firstname, reservation_date, cancellation_reason } = variables;
    
    const content = `
      <h1>Rendez-vous annulé</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Votre rendez-vous du <strong>${new Date(reservation_date).toLocaleDateString('fr-FR')}</strong> a été annulé.</p>
      
      ${cancellation_reason ? `
        <div class="info-box" style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #856404;"><strong>Raison :</strong> ${cancellation_reason}</p>
        </div>
      ` : ''}
      
      <p>Pas de souci ! Vous pouvez reprendre rendez-vous quand vous le souhaitez.</p>
      
      ${createButton('Reprendre rendez-vous', `${frontendUrl}/reservation`)}
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Des questions ? Contactez-nous à 
        <a href="mailto:contact@lesagedev.com" style="color: #0066FF;">contact@lesagedev.com</a>
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Rendez-vous annulé - LE SAGE DEV',
      preheader: 'Votre rendez-vous a été annulé',
      content,
      variables
    });
  };
  
  // ============================================
  // 5. PROJET CRÉÉ
  // ============================================
  
  const projectCreatedEmail = (variables) => {
    const { firstname, project_title, project_type, start_date } = variables;
    
    const content = `
      <h1>Votre projet est lancé ! 🚀</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Excellente nouvelle ! Votre projet <strong>"${project_title}"</strong> vient d'être créé.</p>
      
      ${createInfoBox([
        { label: 'Nom du projet', value: project_title },
        { label: 'Type', value: project_type },
        { label: 'Date de démarrage', value: start_date ? new Date(start_date).toLocaleDateString('fr-FR') : 'À définir' }
      ])}
      
      <p><strong>Prochaines étapes :</strong></p>
      <ol style="line-height: 1.8; color: #333;">
        <li>✅ Analyse détaillée de vos besoins</li>
        <li>🎨 Conception et maquettes</li>
        <li>⚙️ Développement</li>
        <li>✨ Tests et livraison</li>
      </ol>
      
      ${createButton('Suivre mon projet', `${frontendUrl}/dashboard#projects`)}
      
      ${createDivider()}
      
      <p style="font-size: 14px; color: #666;">
        Vous recevrez des notifications à chaque étape importante de votre projet.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Votre projet est lancé - LE SAGE DEV',
      preheader: `Le projet "${project_title}" a été créé`,
      content,
      variables
    });
  };
  
  // ============================================
  // 6. PROJET MIS À JOUR
  // ============================================
  
  const projectUpdatedEmail = (variables) => {
    const { firstname, project_title, update_type, update_message, project_id } = variables;
    
    const updateIcons = {
      'info': 'ℹ️',
      'milestone': '🎯',
      'issue': '⚠️',
      'question': '❓',
      'completed': '✅'
    };
    
    const icon = updateIcons[update_type] || 'ℹ️';
    
    const content = `
      <h1>Mise à jour de votre projet ${icon}</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Une nouvelle mise à jour est disponible pour votre projet <strong>"${project_title}"</strong>.</p>
      
      <div class="info-box" style="background: #e3f2fd; border-left: 4px solid #0066FF; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #0A0E27; font-size: 15px;">
          ${update_message}
        </p>
      </div>
      
      ${createButton('Voir les détails', `${frontendUrl}/dashboard/projects/${project_id}`)}
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Vous pouvez répondre directement depuis votre espace client.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: `Mise à jour - ${project_title}`,
      preheader: update_message.substring(0, 100),
      content,
      variables
    });
  };
  
  // ============================================
  // 7. MESSAGE CONTACT REÇU (pour admin)
  // ============================================
  
  const contactMessageReceivedEmail = (variables) => {
    const { name, email, subject, message, message_id } = variables;
    
    const content = `
      <h1>Nouveau message de contact 📧</h1>
      
      <p>Un nouveau message a été reçu via le formulaire de contact.</p>
      
      ${createInfoBox([
        { label: 'Nom', value: name },
        { label: 'Email', value: email },
        { label: 'Sujet', value: subject }
      ])}
      
      <div class="info-box" style="background: #f5f7fa; border-left: 4px solid #0066FF; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #0A0E27; white-space: pre-wrap;">${message}</p>
      </div>
      
      ${createButton('Répondre au message', `${frontendUrl}/admin/messages/${message_id}`)}
    `;
  
    return generateBaseEmailHTML({
      title: 'Nouveau message de contact',
      preheader: `Message de ${name} : ${subject}`,
      content,
      variables
    });
  };
  
  // ============================================
  // 8. RÉPONSE À UN MESSAGE CONTACT (pour client)
  // ============================================
  
  const contactReplyEmail = (variables) => {
    const { firstname, original_message, reply_message, admin_name } = variables;
    
    const content = `
      <h1>Réponse à votre message 💬</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>${admin_name || 'Notre équipe'} a répondu à votre message :</p>
      
      <div style="background: #f5f7fa; padding: 15px; margin: 20px 0; border-radius: 4px; border-left: 3px solid #ccc;">
        <p style="margin: 0; font-size: 14px; color: #666; font-style: italic;">
          "${original_message.substring(0, 150)}${original_message.length > 150 ? '...' : ''}"
        </p>
      </div>
      
      <div class="info-box" style="background: #e3f2fd; border-left: 4px solid #0066FF; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 10px 0; color: #0066FF; font-weight: 600;">Réponse de ${admin_name || 'LE SAGE DEV'} :</p>
        <p style="margin: 0; color: #0A0E27; white-space: pre-wrap;">${reply_message}</p>
      </div>
      
      ${createButton('Voir la conversation', `${frontendUrl}/mes-messages`)}
      
      <p style="margin-top: 30px; font-size: 14px; color: #666;">
        Vous pouvez continuer la conversation en répondant à cet email.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Réponse à votre message - LE SAGE DEV',
      preheader: `${admin_name || 'Notre équipe'} a répondu à votre message`,
      content,
      variables
    });
  };
  
  // ============================================
  // 9. RESET PASSWORD
  // ============================================
  
  const passwordResetEmail = (variables) => {
    const { firstname, reset_link, expires_in } = variables;
    
    const content = `
      <h1>Réinitialisation de mot de passe 🔐</h1>
      
      <p>Bonjour ${firstname},</p>
      
      <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.</p>
      
      ${createButton('Réinitialiser mon mot de passe', reset_link)}
      
      <div class="info-box" style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404;">
          ⚠️ <strong>Ce lien expire dans ${expires_in || '1 heure'}.</strong>
        </p>
      </div>
      
      <p style="font-size: 14px; color: #666;">
        Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email. Votre mot de passe actuel reste inchangé.
      </p>
      
      ${createDivider()}
      
      <p style="font-size: 12px; color: #999;">
        Pour des raisons de sécurité, ne partagez jamais ce lien.
      </p>
    `;
  
    return generateBaseEmailHTML({
      title: 'Réinitialisation de mot de passe - LE SAGE DEV',
      preheader: 'Cliquez pour créer un nouveau mot de passe',
      content,
      variables
    });
  };
  
  // ============================================
  // EXPORTS
  // ============================================
  
  module.exports = {
    welcomeEmail,
    reservationCreatedEmail,
    reservationConfirmedEmail,
    reservationCancelledEmail,
    projectCreatedEmail,
    projectUpdatedEmail,
    contactMessageReceivedEmail,
    contactReplyEmail,
    passwordResetEmail
  };