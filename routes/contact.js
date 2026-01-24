// backend/routes/contact.js
const express = require('express');
const router = express.Router();
const { getPool } = require('../database/db');

// ============================================
// POST /contact - Formulaire contact public
// ============================================
router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { 
      name, 
      email, 
      phone, 
      company, 
      subject, 
      project_type, 
      budget_range, 
      message 
    } = req.body;

    console.log('📨 Réception message contact:', { name, email, subject });

    // Validation
    if (!name || !email || !message || !subject) {
      return res.status(400).json({ 
        error: 'Champs requis manquants (name, email, subject, message)' 
      });
    }

    // Validation email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    // Insérer le message
    const result = await pool.query(`
      INSERT INTO contact_messages (
        name, 
        email, 
        phone, 
        company, 
        subject, 
        project_type, 
        budget_range, 
        message,
        ip_address,
        user_agent,
        status,
        priority
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new', 'normal')
      RETURNING *
    `, [
      name.trim(),
      email.trim().toLowerCase(),
      phone?.trim() || null,
      company?.trim() || null,
      subject.trim(),
      project_type || null,
      budget_range || null,
      message.trim(),
      req.ip,
      req.headers['user-agent']
    ]);

    console.log('✅ Message contact enregistré:', result.rows[0].id);

    res.json({
      success: true,
      message: 'Message envoyé avec succès',
      id: result.rows[0].id
    });

  } catch (error) {
    console.error('❌ Erreur envoi message contact:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;