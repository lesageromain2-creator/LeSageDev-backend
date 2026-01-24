// backend/routes/admin/projects.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../../middleware/auths');
const { getPool } = require('../../database/db');

router.use(requireAuth, requireAdmin);

// ============================================
// GET /admin/projects - Liste tous les projets
// ============================================
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const { status, user_id, assigned_to, search, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        p.*,
        u.firstname as client_firstname,
        u.lastname as client_lastname,
        u.email as client_email,
        u.company_name as client_company,
        a.firstname as assigned_firstname,
        a.lastname as assigned_lastname,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id) as tasks_total,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'completed') as tasks_completed,
        (SELECT COUNT(*) FROM project_updates WHERE project_id = p.id) as updates_count,
        (SELECT COUNT(*) FROM project_files WHERE project_id = p.id) as files_count
      FROM client_projects p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN users a ON p.assigned_to = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND p.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (user_id) {
      query += ` AND p.user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    if (assigned_to) {
      query += ` AND p.assigned_to = $${paramCount}`;
      params.push(assigned_to);
      paramCount++;
    }

    if (search) {
      query += ` AND (p.title ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR u.firstname ILIKE $${paramCount} OR u.lastname ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY 
      CASE p.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        WHEN 'low' THEN 4 
      END,
      p.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Count total
    const countQuery = `SELECT COUNT(*) FROM client_projects WHERE 1=1`;
    const countResult = await pool.query(countQuery);

    res.json({
      projects: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Erreur récupération projets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /admin/projects/:id - Détails complets d'un projet
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;

    // Récupérer le projet
    const projectResult = await pool.query(`
      SELECT 
        p.*,
        u.firstname as client_firstname,
        u.lastname as client_lastname,
        u.email as client_email,
        u.phone as client_phone,
        u.company_name as client_company,
        a.firstname as assigned_firstname,
        a.lastname as assigned_lastname,
        a.email as assigned_email
      FROM client_projects p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN users a ON p.assigned_to = a.id
      WHERE p.id = $1
    `, [id]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Récupérer les tâches
    const tasksResult = await pool.query(`
      SELECT 
        t.*,
        u.firstname as assigned_firstname,
        u.lastname as assigned_lastname
      FROM project_tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id = $1
      ORDER BY t.created_at DESC
    `, [id]);

    // Récupérer les jalons
    const milestonesResult = await pool.query(`
      SELECT * FROM project_milestones
      WHERE project_id = $1
      ORDER BY display_order, target_date
    `, [id]);

    // Récupérer les mises à jour
    const updatesResult = await pool.query(`
      SELECT 
        pu.*,
        u.firstname,
        u.lastname
      FROM project_updates pu
      LEFT JOIN users u ON pu.created_by = u.id
      WHERE pu.project_id = $1
      ORDER BY pu.created_at DESC
    `, [id]);

    // Récupérer les fichiers
    const filesResult = await pool.query(`
      SELECT 
        pf.*,
        u.firstname as uploaded_by_firstname,
        u.lastname as uploaded_by_lastname
      FROM project_files pf
      JOIN users u ON pf.user_id = u.id
      WHERE pf.project_id = $1
      ORDER BY pf.created_at DESC
    `, [id]);

    // Récupérer les commentaires
    const commentsResult = await pool.query(`
      SELECT 
        pc.*,
        u.firstname,
        u.lastname,
        u.role
      FROM project_comments pc
      JOIN users u ON pc.author_id = u.id
      WHERE pc.project_id = $1
      ORDER BY pc.created_at DESC
    `, [id]);

    res.json({
      project: projectResult.rows[0],
      tasks: tasksResult.rows,
      milestones: milestonesResult.rows,
      updates: updatesResult.rows,
      files: filesResult.rows,
      comments: commentsResult.rows
    });

  } catch (error) {
    console.error('Erreur récupération projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /admin/projects/:id - Mettre à jour un projet
// ============================================
router.put('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { 
      title, 
      description, 
      status, 
      progress, 
      priority,
      assigned_to,
      start_date,
      estimated_delivery,
      notes,
      total_price,
      deposit_paid,
      deposit_amount,
      final_paid,
      staging_url,
      production_url
    } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount}`);
      params.push(title);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    if (status) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
      
      if (status === 'completed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }

    if (progress !== undefined) {
      updates.push(`progress = $${paramCount}`);
      params.push(progress);
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

    if (start_date !== undefined) {
      updates.push(`start_date = $${paramCount}`);
      params.push(start_date);
      paramCount++;
    }

    if (estimated_delivery !== undefined) {
      updates.push(`estimated_delivery = $${paramCount}`);
      params.push(estimated_delivery);
      paramCount++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramCount}`);
      params.push(notes);
      paramCount++;
    }

    if (total_price !== undefined) {
      updates.push(`total_price = $${paramCount}`);
      params.push(total_price);
      paramCount++;
    }

    if (deposit_paid !== undefined) {
      updates.push(`deposit_paid = $${paramCount}`);
      params.push(deposit_paid);
      paramCount++;
    }

    if (deposit_amount !== undefined) {
      updates.push(`deposit_amount = $${paramCount}`);
      params.push(deposit_amount);
      paramCount++;
    }

    if (final_paid !== undefined) {
      updates.push(`final_paid = $${paramCount}`);
      params.push(final_paid);
      paramCount++;
    }

    if (staging_url !== undefined) {
      updates.push(`staging_url = $${paramCount}`);
      params.push(staging_url);
      paramCount++;
    }

    if (production_url !== undefined) {
      updates.push(`production_url = $${paramCount}`);
      params.push(production_url);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE client_projects 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Créer une notification pour le client
    const projectData = result.rows[0];
    await pool.query(`
      INSERT INTO user_notifications (user_id, title, message, type, related_type, related_id)
      VALUES ($1, $2, $3, 'project_update', 'project', $4)
    `, [
      projectData.user_id,
      'Mise à jour de votre projet',
      `Votre projet "${projectData.title}" a été mis à jour.`,
      id
    ]);

    // Log activité
    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description, metadata)
      VALUES ($1, 'update', 'project', $2, 'Mise à jour du projet', $3)
    `, [req.userId, id, JSON.stringify({ status, progress })]);

    res.json({
      success: true,
      project: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur mise à jour projet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /admin/projects/:id/tasks - Créer une tâche
// ============================================
router.post('/:id/tasks', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, description, status, priority, assigned_to, due_date } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }

    const result = await pool.query(`
      INSERT INTO project_tasks (project_id, title, description, status, priority, assigned_to, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [id, title, description || null, status || 'todo', priority || 'normal', assigned_to || null, due_date || null]);

    await pool.query(`
      INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, description)
      VALUES ($1, 'create', 'project_task', $2, $3)
    `, [req.userId, result.rows[0].id, `Tâche créée: ${title}`]);

    res.json({
      success: true,
      task: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur création tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /admin/projects/tasks/:taskId - Mettre à jour une tâche
// ============================================
router.put('/tasks/:taskId', async (req, res) => {
  try {
    const pool = getPool();
    const { taskId } = req.params;
    const { title, description, status, priority, assigned_to, due_date } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount}`);
      params.push(title);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    if (status) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
      
      if (status === 'completed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
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

    if (due_date !== undefined) {
      updates.push(`due_date = $${paramCount}`);
      params.push(due_date);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    params.push(taskId);
    const query = `
      UPDATE project_tasks 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }

    res.json({
      success: true,
      task: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur mise à jour tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// DELETE /admin/projects/tasks/:taskId - Supprimer une tâche
// ============================================
router.delete('/tasks/:taskId', async (req, res) => {
  try {
    const pool = getPool();
    const { taskId } = req.params;

    await pool.query('DELETE FROM project_tasks WHERE id = $1', [taskId]);

    res.json({ success: true });

  } catch (error) {
    console.error('Erreur suppression tâche:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /admin/projects/:id/milestones - Créer un jalon
// ============================================
router.post('/:id/milestones', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { title, description, target_date, display_order } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }

    const result = await pool.query(`
      INSERT INTO project_milestones (project_id, title, description, target_date, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, title, description || null, target_date || null, display_order || 0]);

    res.json({
      success: true,
      milestone: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur création jalon:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /admin/projects/milestones/:milestoneId - Mettre à jour un jalon
// ============================================
router.put('/milestones/:milestoneId', async (req, res) => {
  try {
    const pool = getPool();
    const { milestoneId } = req.params;
    const { title, description, target_date, is_completed, display_order } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount}`);
      params.push(title);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    if (target_date !== undefined) {
      updates.push(`target_date = $${paramCount}`);
      params.push(target_date);
      paramCount++;
    }

    if (is_completed !== undefined) {
      updates.push(`is_completed = $${paramCount}`);
      params.push(is_completed);
      paramCount++;
      
      if (is_completed) {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }

    if (display_order !== undefined) {
      updates.push(`display_order = $${paramCount}`);
      params.push(display_order);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    params.push(milestoneId);
    const query = `
      UPDATE project_milestones 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Jalon non trouvé' });
    }

    res.json({
      success: true,
      milestone: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur mise à jour jalon:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /admin/projects/:id/comments - Ajouter un commentaire
// ============================================
router.post('/:id/comments', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { comment, is_internal } = req.body;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
    }

    const result = await pool.query(`
      INSERT INTO project_comments (project_id, author_id, comment, is_internal)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, req.userId, comment, is_internal || false]);

    // Si commentaire public, notifier le client
    if (!is_internal) {
      const projectResult = await pool.query('SELECT user_id, title FROM client_projects WHERE id = $1', [id]);
      if (projectResult.rows.length > 0) {
        await pool.query(`
          INSERT INTO user_notifications (user_id, title, message, type, related_type, related_id)
          VALUES ($1, $2, $3, 'project_update', 'project', $4)
        `, [
          projectResult.rows[0].user_id,
          'Nouveau commentaire sur votre projet',
          `Un commentaire a été ajouté sur "${projectResult.rows[0].title}"`,
          id
        ]);
      }
    }

    res.json({
      success: true,
      comment: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur ajout commentaire:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /admin/projects/stats/overview - Statistiques projets
// ============================================
router.get('/stats/overview', async (req, res) => {
  try {
    const pool = getPool();

    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'discovery') as discovery,
        COUNT(*) FILTER (WHERE status = 'design') as design,
        COUNT(*) FILTER (WHERE status = 'development') as development,
        COUNT(*) FILTER (WHERE status = 'testing') as testing,
        COUNT(*) FILTER (WHERE status = 'launched') as launched,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as new_this_month,
        AVG(progress) as avg_progress
      FROM client_projects
      WHERE status NOT IN ('cancelled', 'completed')
    `);

    res.json(stats.rows[0]);

  } catch (error) {
    console.error('Erreur stats projets:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

// ============================================
// POST /admin/projects/:id/files - Upload fichier
// ============================================
router.post('/:id/files', async (req, res) => {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { file_name, file_url, file_type, file_size, mime_type, description } = req.body;
  
      if (!file_name || !file_url) {
        return res.status(400).json({ error: 'Nom et URL du fichier requis' });
      }
  
      // Vérifier que le projet existe
      const projectCheck = await pool.query(
        'SELECT id, user_id, title FROM client_projects WHERE id = $1',
        [id]
      );
  
      if (projectCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Projet non trouvé' });
      }
  
      const project = projectCheck.rows[0];
  
      // Insérer le fichier
      const result = await pool.query(`
        INSERT INTO project_files (
          project_id, 
          user_id, 
          file_name, 
          file_url, 
          file_type, 
          file_size, 
          mime_type,
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        id, 
        req.userId, // Admin qui upload
        file_name, 
        file_url, 
        file_type || 'other', 
        file_size || null, 
        mime_type || 'application/octet-stream',
        description || null
      ]);
  
      // Notifier le client
      await pool.query(`
        INSERT INTO user_notifications (
          user_id, 
          title, 
          message, 
          type, 
          related_type, 
          related_id
        )
        VALUES ($1, $2, $3, 'project_update', 'project', $4)
      `, [
        project.user_id,
        'Nouveau fichier ajouté',
        `Un fichier "${file_name}" a été ajouté à votre projet "${project.title}"`,
        id
      ]);
  
      // Log activité
      await pool.query(`
        INSERT INTO admin_activity_logs (
          admin_id, 
          action, 
          entity_type, 
          entity_id, 
          description
        )
        VALUES ($1, 'create', 'project_file', $2, $3)
      `, [req.userId, result.rows[0].id, `Fichier ajouté: ${file_name}`]);
  
      res.json({
        success: true,
        file: result.rows[0]
      });
  
    } catch (error) {
      console.error('Erreur upload fichier:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
  
  // ============================================
  // DELETE /admin/projects/files/:fileId - Supprimer fichier
  // ============================================
  router.delete('/files/:fileId', async (req, res) => {
    try {
      const pool = getPool();
      const { fileId } = req.params;
  
      const result = await pool.query(
        'DELETE FROM project_files WHERE id = $1 RETURNING *',
        [fileId]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
      }
  
      res.json({ success: true });
  
    } catch (error) {
      console.error('Erreur suppression fichier:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
  


  
  // ============================================
  // POST /admin/projects/:id/update-message - Envoyer update client
  // ============================================
  router.post('/:id/update-message', async (req, res) => {
    try {
      const pool = getPool();
      const { id } = req.params;
      const { title, message, update_type } = req.body;
  
      if (!title || !message) {
        return res.status(400).json({ error: 'Titre et message requis' });
      }
  
      const projectCheck = await pool.query(
        'SELECT id, user_id, title FROM client_projects WHERE id = $1',
        [id]
      );
  
      if (projectCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Projet non trouvé' });
      }
  
      const project = projectCheck.rows[0];
  
      // Créer l'update
      const updateResult = await pool.query(`
        INSERT INTO project_updates (
          project_id, 
          created_by, 
          title, 
          message, 
          update_type
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [id, req.userId, title, message, update_type || 'info']);
  
      // Notifier le client
      await pool.query(`
        INSERT INTO user_notifications (
          user_id, 
          title, 
          message, 
          type, 
          related_type, 
          related_id
        )
        VALUES ($1, $2, $3, 'project_update', 'project', $4)
      `, [
        project.user_id,
        title,
        message.substring(0, 200) + (message.length > 200 ? '...' : ''),
        id
      ]);
  
      res.json({
        success: true,
        update: updateResult.rows[0]
      });
  
    } catch (error) {
      console.error('Erreur envoi update:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
  
  // ============================================
  // DELETE /admin/projects/milestones/:milestoneId - Supprimer jalon
  // ============================================
  router.delete('/milestones/:milestoneId', async (req, res) => {
    try {
      const pool = getPool();
      const { milestoneId } = req.params;
  
      await pool.query('DELETE FROM project_milestones WHERE id = $1', [milestoneId]);
  
      res.json({ success: true });
  
    } catch (error) {
      console.error('Erreur suppression jalon:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });