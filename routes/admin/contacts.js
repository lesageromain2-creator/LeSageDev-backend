// backend/routes/admin/contacts.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../../middleware/auths');
const { getPool } = require('../../database/db');

// Middleware helper pour toutes les routes admin
const adminOnly = [requireAuth, requireAdmin];

// ============================================
// GET /admin/contact/stats/overview - Statistiques messages
// ⚠️ DOIT ÊTRE AVANT /:id SINON 'stats' SERA INTERPRÉTÉ COMME UN ID
// ============================================
router.get('/stats/overview', adminOnly, async (req, res) => {
  try {
    const pool = getPool();

    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_messages,
        COUNT(*) FILTER (WHERE status = 'read') as read,
        COUNT(*) FILTER (WHERE status = 'replied') as replied,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days') as this_week,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as this_month
      FROM contact_messages
      WHERE status != 'archived'
    `);

    res.json(stats.rows[0]);

  } catch (error) {
    console.error('Erreur stats messages:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /admin/contact - Liste tous les messages
// ============================================
router.get('/', adminOnly, async (req, res) => {
  try {
    const pool = getPool();
    const { status, priority, search, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        cm.*,
        u.firstname as assigned_firstname,
        u.lastname as assigned_lastname,
        (SELECT COUNT(*) FROM contact_message_replies WHERE message_id = cm.id) as reply_count
      FROM contact_messages cm
      LEFT JOIN users u ON cm.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND cm.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (priority) {
      query += ` AND cm.priority = $${paramCount}`;
      params.push(priority);
      paramCount++;
    }

    if (search) {
      query += ` AND (cm.name ILIKE $${paramCount} OR cm.email ILIKE $${paramCount} OR cm.subject ILIKE $${paramCount} OR cm.message ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY 
      CASE cm.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        WHEN 'low' THEN 4 
      END,
      cm.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Count total
    const countQuery = `SELECT COUNT(*) FROM contact_messages WHERE 1=1 ${status ? 'AND status = $1' : ''}`;
    const countResult = await pool.query(countQuery, status ? [status] : []);

    res.json({
      messages: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Erreur récupération messages:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /admin/contact/:id - Détails d'un message
// ============================================
router.get('/:id', adminOnly, async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        cm.*,
        u.firstname as assigned_firstname,
        u.lastname as assigned_lastname,
        u.email as assigned_email
      FROM contact_messages cm
      LEFT JOIN users u ON cm.assigned_to = u.id
      WHERE cm.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }

    // Récupérer les réponses
    const repliesResult = await pool.query(`
      SELECT 
        cmr.*,
        u.firstname,
        u.lastname,
        u.email
      FROM contact_message_replies cmr
      JOIN users u ON cmr.admin_id = u.id
      WHERE cmr.message_id = $1
      ORDER BY cmr.created_at ASC
    `, [id]);

    res.json({
      message: result.rows[0],
      replies: repliesResult.rows
    });

  } catch (error) {
    console.error('Erreur récupération message:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /admin/contact/:id - Mettre à jour message
// ============================================
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { status, priority, assigned_to } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (status) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (priority) {
      updates.push(`priority = $${paramCount}`);
      params.push(priority);
      paramCount++;
    }

    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramCount}`);
      params.push(assigned_to || null);
      paramCount++;
    }

    if (status === 'read' || status === 'replied') {
      updates.push(`read_at = CURRENT_TIMESTAMP`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    params.push(id);
    const query = `
      UPDATE contact_messages 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }

    // Log activité (avec gestion d'erreur)
    try {
      await pool.query(`
        INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description)
        VALUES ($1, 'update', 'contact_message', $2, $3)
      `, [req.userId, id, `Mise à jour du statut: ${status || 'N/A'}`]);
    } catch (logError) {
      console.warn('⚠️ Impossible de logger:', logError.message);
    }

    res.json({
      success: true,
      message: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur mise à jour message:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /admin/contact/:id/reply - Répondre à un message
// ============================================
router.post('/:id/reply', adminOnly, async (req, res) => {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { reply_text } = req.body;
  
      console.log('📧 Réponse admin au message:', id);
  
      if (!reply_text || reply_text.trim() === '') {
        return res.status(400).json({ error: 'La réponse ne peut pas être vide' });
      }
  
      // Récupérer les infos du message
      const messageResult = await pool.query(`
        SELECT id, name, email, subject FROM contact_messages WHERE id = $1
      `, [id]);
  
      if (messageResult.rows.length === 0) {
        return res.status(404).json({ error: 'Message non trouvé' });
      }
  
      const message = messageResult.rows[0];
  
      // Insérer la réponse
      const replyResult = await pool.query(`
        INSERT INTO contact_message_replies (message_id, admin_id, reply_text)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [id, req.userId, reply_text]);
  
      console.log('✅ Réponse enregistrée:', replyResult.rows[0].id);
  
      // Mettre à jour le message
      await pool.query(`
        UPDATE contact_messages 
        SET status = 'replied', replied_at = CURRENT_TIMESTAMP, replied_by = $1
        WHERE id = $2
      `, [req.userId, id]);
  
      // Si l'utilisateur a un compte, créer une notification
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [message.email]
      );
  
      if (userCheck.rows.length > 0) {
        try {
          await pool.query(`
            INSERT INTO user_notifications (
              user_id, 
              title, 
              message, 
              type, 
              related_type, 
              related_id
            )
            VALUES ($1, $2, $3, 'info', 'contact_message', $4)
          `, [
            userCheck.rows[0].id,
            'Réponse à votre message',
            `Nous avons répondu à votre message "${message.subject}". Consultez votre espace client.`,
            id
          ]);
          
          console.log('✅ Notification créée pour utilisateur');
        } catch (notifError) {
          console.warn('⚠️ Impossible de créer notification:', notifError.message);
        }
      }
  
      // Log activité
      try {
        await pool.query(`
          INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description)
          VALUES ($1, 'reply', 'contact_message', $2, 'Réponse envoyée')
        `, [req.userId, id]);
      } catch (logError) {
        console.warn('⚠️ Impossible de logger:', logError.message);
      }
  
      // ✅ NOUVEAU: Envoyer l'email au client
      try {
        const emailResult = await sendContactReply(
          message.email,
          message.name,
          message.subject,
          reply_text
        );
  
        if (emailResult.success) {
          console.log('✅ Email de réponse envoyé à:', message.email);
        } else {
          console.error('❌ Échec envoi email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Erreur lors de l\'envoi de l\'email:', emailError);
        // On ne fait pas échouer la requête si l'email échoue
      }
  
      res.json({
        success: true,
        reply: replyResult.rows[0],
        message: 'Réponse enregistrée avec succès'
      });
  
    } catch (error) {
      console.error('❌ Erreur envoi réponse:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

// ============================================
// DELETE /admin/contact/:id - Supprimer/archiver message
// ============================================
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { permanent = false } = req.query;

    if (permanent) {
      await pool.query('DELETE FROM contact_messages WHERE id = $1', [id]);
    } else {
      await pool.query(`UPDATE contact_messages SET status = 'archived' WHERE id = $1`, [id]);
    }

    // Log activité (avec gestion d'erreur)
    try {
      await pool.query(`
        INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description)
        VALUES ($1, 'delete', 'contact_message', $2, $3)
      `, [req.userId, id, permanent ? 'Suppression définitive' : 'Archivé']);
    } catch (logError) {
      console.warn('⚠️ Impossible de logger:', logError.message);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur suppression message:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;