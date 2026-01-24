// backend/routes/admin/reservations.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../../middleware/auths');
const { getPool } = require('../../database/db');

router.use(requireAuth, requireAdmin);

// ============================================
// ROUTES SPÉCIFIQUES (DOIVENT ÊTRE AVANT /:id)
// ============================================

// GET /admin/reservations/stats/overview - Statistiques réservations
router.get('/stats/overview', async (req, res) => {
  try {
    const pool = getPool();

    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE meeting_type = 'visio') as visio,
        COUNT(*) FILTER (WHERE meeting_type = 'presentiel') as presentiel,
        COUNT(*) FILTER (WHERE reservation_date >= CURRENT_DATE) as upcoming,
        COUNT(*) FILTER (WHERE reservation_date >= CURRENT_DATE AND reservation_date < CURRENT_DATE + INTERVAL '7 days') as this_week,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as new_this_month
      FROM reservations
    `);

    res.json(stats.rows[0]);

  } catch (error) {
    console.error('Erreur stats réservations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /admin/reservations/calendar/view - Vue calendrier
router.get('/calendar/view', async (req, res) => {
  try {
    const pool = getPool();
    const { month, year } = req.query;

    let query = `
      SELECT 
        r.id,
        r.reservation_date,
        r.reservation_time,
        r.duration,
        r.status,
        r.meeting_type,
        u.firstname,
        u.lastname,
        u.company_name
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      WHERE r.status != 'cancelled'
    `;
    const params = [];

    if (month && year) {
      query += ` AND EXTRACT(MONTH FROM r.reservation_date) = $1 AND EXTRACT(YEAR FROM r.reservation_date) = $2`;
      params.push(month, year);
    }

    query += ` ORDER BY r.reservation_date, r.reservation_time`;

    const result = await pool.query(query, params);

    res.json({
      events: result.rows
    });

  } catch (error) {
    console.error('Erreur vue calendrier:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ROUTES GÉNÉRIQUES
// ============================================

// GET /admin/reservations - Liste toutes les réservations
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const { 
      status, 
      meeting_type, 
      from_date, 
      to_date, 
      search, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let query = `
      SELECT 
        r.*,
        u.firstname,
        u.lastname,
        u.email,
        u.phone,
        u.company_name,
        c.firstname as confirmed_by_firstname,
        c.lastname as confirmed_by_lastname
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users c ON r.confirmed_by = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (meeting_type) {
      query += ` AND r.meeting_type = $${paramCount}`;
      params.push(meeting_type);
      paramCount++;
    }

    if (from_date) {
      query += ` AND r.reservation_date >= $${paramCount}`;
      params.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND r.reservation_date <= $${paramCount}`;
      params.push(to_date);
      paramCount++;
    }

    if (search) {
      query += ` AND (u.firstname ILIKE $${paramCount} OR u.lastname ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR r.project_type ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY r.reservation_date DESC, r.reservation_time DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Count total avec les mêmes filtres
    let countQuery = `
      SELECT COUNT(*) 
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const countParams = [];
    let countParamCount = 1;

    if (status) {
      countQuery += ` AND r.status = $${countParamCount}`;
      countParams.push(status);
      countParamCount++;
    }

    if (meeting_type) {
      countQuery += ` AND r.meeting_type = $${countParamCount}`;
      countParams.push(meeting_type);
      countParamCount++;
    }

    if (from_date) {
      countQuery += ` AND r.reservation_date >= $${countParamCount}`;
      countParams.push(from_date);
      countParamCount++;
    }

    if (to_date) {
      countQuery += ` AND r.reservation_date <= $${countParamCount}`;
      countParams.push(to_date);
      countParamCount++;
    }

    if (search) {
      countQuery += ` AND (u.firstname ILIKE $${countParamCount} OR u.lastname ILIKE $${countParamCount} OR u.email ILIKE $${countParamCount} OR r.project_type ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
      countParamCount++;
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      reservations: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Erreur récupération réservations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /admin/reservations - Créer une réservation (pour le client)
router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { 
      user_id,
      reservation_date, 
      reservation_time,
      duration,
      meeting_type,
      project_type,
      estimated_budget,
      message,
      admin_notes
    } = req.body;

    if (!user_id || !reservation_date || !reservation_time) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    const result = await pool.query(`
      INSERT INTO reservations (
        user_id, 
        reservation_date, 
        reservation_time,
        duration,
        meeting_type,
        project_type,
        estimated_budget,
        message,
        admin_notes,
        status,
        confirmed_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', $10)
      RETURNING *
    `, [
      user_id,
      reservation_date,
      reservation_time,
      duration || 60,
      meeting_type || 'visio',
      project_type,
      estimated_budget,
      message,
      admin_notes,
      req.userId
    ]);

    // Notifier le client
    await pool.query(`
      INSERT INTO user_notifications (user_id, title, message, type, related_type, related_id)
      VALUES ($1, 'Nouveau rendez-vous', $2, 'success', 'reservation', $3)
    `, [
      user_id,
      `Un rendez-vous a été programmé pour le ${new Date(reservation_date).toLocaleDateString('fr-FR')} à ${reservation_time}`,
      result.rows[0].id
    ]);

    // Log activité
    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description)
      VALUES ($1, 'create', 'reservation', $2, 'Création rendez-vous admin')
    `, [req.userId, result.rows[0].id]);

    res.json({
      success: true,
      reservation: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur création réservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// ROUTES AVEC PARAMÈTRES (DOIVENT ÊTRE À LA FIN)
// ============================================

// GET /admin/reservations/:id - Détails d'une réservation
router.get('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        r.*,
        u.firstname,
        u.lastname,
        u.email,
        u.phone,
        u.company_name,
        u.created_at as user_created_at,
        c.firstname as confirmed_by_firstname,
        c.lastname as confirmed_by_lastname
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users c ON r.confirmed_by = c.id
      WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    // Récupérer l'historique des projets du client
    const projectsResult = await pool.query(`
      SELECT id, title, status, created_at
      FROM client_projects
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [result.rows[0].user_id]);

    res.json({
      reservation: result.rows[0],
      client_projects: projectsResult.rows
    });

  } catch (error) {
    console.error('Erreur récupération réservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /admin/reservations/:id - Mettre à jour une réservation
router.put('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { 
      status, 
      reservation_date, 
      reservation_time,
      meeting_type,
      admin_notes 
    } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (status) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;

      if (status === 'confirmed') {
        updates.push(`confirmed_by = $${paramCount}`);
        params.push(req.userId);
        paramCount++;
      }

      if (status === 'cancelled') {
        updates.push(`cancelled_at = CURRENT_TIMESTAMP`);
      }
    }

    if (reservation_date) {
      updates.push(`reservation_date = $${paramCount}`);
      params.push(reservation_date);
      paramCount++;
    }

    if (reservation_time) {
      updates.push(`reservation_time = $${paramCount}`);
      params.push(reservation_time);
      paramCount++;
    }

    if (meeting_type) {
      updates.push(`meeting_type = $${paramCount}`);
      params.push(meeting_type);
      paramCount++;
    }

    if (admin_notes !== undefined) {
      updates.push(`admin_notes = $${paramCount}`);
      params.push(admin_notes);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE reservations 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    // Notifier le client si changement de statut
    if (status) {
      const reservation = result.rows[0];
      let notifTitle = '';
      let notifMessage = '';

      switch (status) {
        case 'confirmed':
          notifTitle = 'Rendez-vous confirmé';
          notifMessage = `Votre rendez-vous du ${new Date(reservation.reservation_date).toLocaleDateString('fr-FR')} à ${reservation.reservation_time} est confirmé.`;
          break;
        case 'cancelled':
          notifTitle = 'Rendez-vous annulé';
          notifMessage = `Votre rendez-vous du ${new Date(reservation.reservation_date).toLocaleDateString('fr-FR')} a été annulé.`;
          break;
        case 'completed':
          notifTitle = 'Rendez-vous terminé';
          notifMessage = 'Merci pour votre rendez-vous. Nous vous contacterons bientôt.';
          break;
      }

      if (notifTitle) {
        await pool.query(`
          INSERT INTO user_notifications (user_id, title, message, type, related_type, related_id)
          VALUES ($1, $2, $3, 'info', 'reservation', $4)
        `, [reservation.user_id, notifTitle, notifMessage, id]);
      }
    }

    // Log activité
    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description)
      VALUES ($1, 'update', 'reservation', $2, $3)
    `, [req.userId, id, `Mise à jour: ${status || 'modification'}`]);

    res.json({
      success: true,
      reservation: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur mise à jour réservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /admin/reservations/:id - Supprimer une réservation
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    // Vérifier que la réservation existe
    const checkResult = await pool.query('SELECT id FROM reservations WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    await pool.query('DELETE FROM reservations WHERE id = $1', [id]);

    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description)
      VALUES ($1, 'delete', 'reservation', $2, 'Suppression définitive')
    `, [req.userId, id]);

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur suppression réservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;