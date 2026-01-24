// backend/routes/reservations.js - VERSION JWT (Rendez-vous consultation)
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auths');

// Helper pour exécuter des requêtes
const query = async (pool, sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows;
};

const queryOne = async (pool, sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
};

// ============================================
// VÉRIFIER LES DISPONIBILITÉS (PUBLIC)
// ============================================
router.post('/check-availability', async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const { reservation_date, reservation_time } = req.body;

    if (!reservation_date || !reservation_time) {
      return res.status(400).json({ error: 'Date et heure requises' });
    }

    // Vérifier s'il y a déjà un rendez-vous à cette heure
    const existingReservation = await queryOne(pool,
      `SELECT id FROM reservations 
       WHERE reservation_date = $1
       AND reservation_time = $2
       AND status IN ('confirmed', 'pending')`,
      [reservation_date, reservation_time]
    );

    res.json({
      available: !existingReservation,
      date: reservation_date,
      time: reservation_time
    });
  } catch (error) {
    console.error('Erreur check availability:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// CRÉER UN RENDEZ-VOUS (JWT AUTH)
// ============================================
router.post('/', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.userId;
  
  try {
    const {
      reservation_date,
      reservation_time,
      meeting_type,
      project_type,
      estimated_budget,
      message
    } = req.body;

    console.log('📝 Création rendez-vous pour user:', userId);
    console.log('📋 Données reçues:', req.body);

    // Validation des champs requis
    if (!reservation_date || !reservation_time) {
      return res.status(400).json({ 
        error: 'Date et heure du rendez-vous requis' 
      });
    }

    // Vérifier date future
    const reservationDateTime = new Date(`${reservation_date}T${reservation_time}`);
    if (reservationDateTime < new Date()) {
      return res.status(400).json({ 
        error: 'La date du rendez-vous doit être dans le futur' 
      });
    }

    // Vérifier horaires de travail (9h-18h)
    const [hour] = reservation_time.split(':').map(Number);
    if (hour < 9 || hour >= 18) {
      return res.status(400).json({ 
        error: 'Horaires disponibles : 9h00 - 18h00' 
      });
    }

    // Vérifier si le créneau est disponible
    const existingReservation = await queryOne(pool,
      `SELECT id FROM reservations 
       WHERE reservation_date = $1
       AND reservation_time = $2
       AND status IN ('confirmed', 'pending')`,
      [reservation_date, reservation_time]
    );

    if (existingReservation) {
      return res.status(400).json({ 
        error: 'Ce créneau n\'est plus disponible, veuillez en choisir un autre'
      });
    }

    // Créer le rendez-vous
    const result = await query(pool,
      `INSERT INTO reservations 
       (user_id, reservation_date, reservation_time, meeting_type, project_type, estimated_budget, message, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        userId, 
        reservation_date, 
        reservation_time, 
        meeting_type || 'visio',
        project_type || null,
        estimated_budget || null,
        message || null
      ]
    );

    console.log('✅ Rendez-vous créé:', result[0]);

    res.status(201).json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      reservation: result[0]
    });
  } catch (error) {
    console.error('❌ Erreur create reservation:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de la création du rendez-vous' 
    });
  }
});

// ============================================
// RÉCUPÉRER LES RÉSERVATIONS DE L'UTILISATEUR (JWT AUTH)
// ============================================
router.get('/my', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.userId; // ✅ JWT
  
  try {
    console.log('📋 Récupération réservations pour user:', userId);
    
    const reservations = await query(pool,
      `SELECT * FROM reservations 
       WHERE user_id = $1 
       ORDER BY reservation_date DESC, reservation_time DESC`,
      [userId]
    );

    console.log(`✅ ${reservations.length} réservations trouvées`);

    res.json({ 
      success: true,
      reservations 
    });
  } catch (error) {
    console.error('❌ Erreur get my reservations:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur' 
    });
  }
});

// ============================================
// RÉCUPÉRER UNE RÉSERVATION PAR ID (JWT AUTH)
// ============================================
router.get('/:id', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.userId; // ✅ JWT
  const userRole = req.userRole; // ✅ JWT
  
  try {
    const reservation = await queryOne(pool,
      `SELECT r.*, u.firstname, u.lastname, u.email, u.phone
       FROM reservations r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (!reservation) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    // Vérifier propriétaire ou admin
    if (reservation.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json({
      success: true,
      reservation
    });
  } catch (error) {
    console.error('❌ Erreur get reservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ANNULER UNE RÉSERVATION (JWT AUTH)
// ============================================
router.put('/:id/cancel', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.userId; // ✅ JWT
  const userRole = req.userRole; // ✅ JWT
  
  try {
    const reservation = await queryOne(pool,
      'SELECT * FROM reservations WHERE id = $1',
      [req.params.id]
    );

    if (!reservation) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    // Vérifier propriétaire ou admin
    if (reservation.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    if (reservation.status === 'cancelled') {
      return res.status(400).json({ error: 'Réservation déjà annulée' });
    }

    // Vérifier 2h avant
    const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`);
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

    if (reservationDateTime < twoHoursFromNow) {
      return res.status(400).json({ 
        error: 'Impossible d\'annuler moins de 2h avant la réservation' 
      });
    }

    await query(pool,
      'UPDATE reservations SET status = $1, cancelled_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['cancelled', req.params.id]
    );

    res.json({ 
      success: true,
      message: 'Réservation annulée avec succès' 
    });
  } catch (error) {
    console.error('❌ Erreur cancel reservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// SUPPRIMER UNE RÉSERVATION (JWT AUTH)
// ============================================
router.delete('/:id', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const userId = req.userId; // ✅ JWT
  const userRole = req.userRole; // ✅ JWT
  const { id } = req.params;

  try {
    // Vérifier propriétaire ou admin
    const checkQuery = `
      SELECT * FROM reservations 
      WHERE id = $1 
      AND (user_id = $2 OR $3 = 'admin')
    `;
    const checkResult = await query(pool, checkQuery, [id, userId, userRole]);

    if (checkResult.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Réservation non trouvée ou accès non autorisé' 
      });
    }

    // Supprimer
    const result = await query(pool,
      'DELETE FROM reservations WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({
      success: true,
      message: 'Réservation supprimée avec succès',
      reservation: result[0]
    });
  } catch (error) {
    console.error('❌ Erreur DELETE /reservations/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ADMIN: TOUTES LES RÉSERVATIONS (JWT ADMIN)
// ============================================
router.get('/admin/all', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const { date, status } = req.query;
    let sql = `
      SELECT r.*, u.firstname, u.lastname, u.email, u.phone
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (date) {
      sql += ` AND r.reservation_date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (status) {
      sql += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ' ORDER BY r.reservation_date DESC, r.reservation_time DESC';

    const reservations = await query(pool, sql, params);

    res.json({ 
      success: true,
      reservations 
    });
  } catch (error) {
    console.error('❌ Erreur get all reservations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ADMIN: CONFIRMER UNE RÉSERVATION (JWT ADMIN)
// ============================================
router.put('/:id/confirm', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    await query(pool,
      'UPDATE reservations SET status = $1 WHERE id = $2',
      ['confirmed', req.params.id]
    );

    res.json({ 
      success: true,
      message: 'Réservation confirmée avec succès' 
    });
  } catch (error) {
    console.error('❌ Erreur confirm reservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;