// backend/server.js - VERSION JWT AVEC FIX SUPABASE
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initPool } = require('./database/db');

// Import des routes
// Import des routes
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const userRoutes = require('./routes/users');
const reservationRoutes = require('./routes/reservations');
const menusRoutes = require('./routes/menus');
const dashboardRoutes = require('./routes/dashboard');
const categoriesRoutes = require('./routes/categories');
const dishesRoutes = require('./routes/dishes');
const favoritesRoutes = require('./routes/favorites');
const adminContactRoutes = require('./routes/admin/contacts'); 
const adminProjectsRoutes = require('./routes/admin/projects');
const adminReservationsRoutes = require('./routes/admin/reservations');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const contactRoutes = require('./routes/contact');

const app = express();
const PORT = process.env.PORT || 5000;

// ⚠️ CRITIQUE : Trust proxy pour Render
app.set('trust proxy', 1);

// ============================================
// CONFIGURATION CORS - VERSION JWT
// ============================================
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

// Patterns pour Vercel et localhost
const allowedPatterns = [
  /^https:\/\/lesagedev.*\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

console.log('🌍 CORS - Origines autorisées:', allowedOrigins);
console.log('🔍 CORS - Patterns autorisés:', allowedPatterns.map(p => p.toString()));

app.use(cors({
  origin: function (origin, callback) {
    console.log('🔍 CORS - Origin reçue:', origin);
    
    // Autoriser requêtes sans origin (Postman, mobile apps)
    if (!origin) {
      console.log('✅ CORS - Requête sans origin autorisée');
      return callback(null, true);
    }
    
    // Vérifier origines fixes
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS - Origin autorisée (fixe):', origin);
      return callback(null, true);
    }
    
    // Vérifier patterns
    const matchesPattern = allowedPatterns.some(pattern => pattern.test(origin));
    if (matchesPattern) {
      console.log('✅ CORS - Origin autorisée (pattern):', origin);
      return callback(null, true);
    }
    
    console.log('❌ CORS - Origin refusée:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Authorization'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Gérer OPTIONS explicitement
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin) || allowedPatterns.some(p => p.test(origin))) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.sendStatus(204);
});

// ============================================
// POSTGRESQL POOL - CONFIGURATION OPTIMISÉE SUPABASE
// ============================================

// Parse DATABASE_URL pour debugging
const dbUrl = process.env.DATABASE_URL;
console.log('🔍 DATABASE_URL:', dbUrl ? dbUrl.replace(/:[^:@]+@/, ':****@') : 'NON DÉFINIE');

if (!dbUrl) {
  console.error('❌ ERREUR: DATABASE_URL non définie dans .env');
  process.exit(1);
}

// Configuration pool optimisée pour Supabase
const poolConfig = {
  connectionString: dbUrl,
  
  // Configuration SSL pour Supabase
  ssl: {
    rejectUnauthorized: false
  },
  
  // Timeouts augmentés pour connexions lentes
  connectionTimeoutMillis: 60000, // 60 secondes
  idleTimeoutMillis: 30000, // 30 secondes
  query_timeout: 30000, // 30 secondes
  
  // Pool settings
  max: 5, // Réduit pour environnement de dev
  min: 0,
  
  // Keepalive pour maintenir les connexions
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // Options supplémentaires pour Supabase
  application_name: 'lesage_app',
  statement_timeout: 30000
};

console.log('⚙️ Configuration Pool PostgreSQL:', {
  max: poolConfig.max,
  connectionTimeout: poolConfig.connectionTimeoutMillis,
  idleTimeout: poolConfig.idleTimeoutMillis,
  keepAlive: poolConfig.keepAlive
});

const pool = new Pool(poolConfig);

initPool(pool);
app.locals.pool = pool;

// Test de connexion initial avec retry amélioré
const testConnection = async (retries = 5) => {
  console.log('\n🔌 Tentative de connexion à Supabase...');
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`  Tentative ${i + 1}/${retries}...`);
      const client = await pool.connect();
      
      // Test avec une vraie requête
      const result = await client.query('SELECT NOW() as now, current_database() as db');
      console.log('✅ Connecté à Supabase PostgreSQL');
      console.log('  📅 Date serveur:', result.rows[0].now);
      console.log('  🗄️ Base de données:', result.rows[0].db);
      
      client.release();
      return true;
    } catch (err) {
      console.error(`❌ Tentative ${i + 1}/${retries} échouée:`, err.message);
      
      if (err.code === 'ETIMEDOUT') {
        console.error('  ⚠️ Timeout de connexion - Vérifiez:');
        console.error('    1. Que DATABASE_URL est correcte');
        console.error('    2. Que votre IP est autorisée dans Supabase');
        console.error('    3. Que le firewall autorise le port 6543 ou 5432');
        console.error('    4. Votre connexion internet');
      }
      
      if (i < retries - 1) {
        const waitTime = Math.min(5000 * (i + 1), 15000);
        console.log(`  ⏳ Nouvelle tentative dans ${waitTime/1000} secondes...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error('\n❌ ÉCHEC: Impossible de se connecter à Supabase');
  console.error('📋 Checklist de dépannage:');
  console.error('  1. Vérifiez DATABASE_URL dans backend/.env');
  console.error('  2. Vérifiez que votre projet Supabase est actif');
  console.error('  3. Vérifiez les paramètres de connexion dans Supabase Dashboard');
  console.error('  4. Essayez de changer le port 6543 par 5432 dans DATABASE_URL');
  console.error('  5. Désactivez temporairement votre antivirus/firewall');
  
  return false;
};

testConnection().then(success => {
  if (!success) {
    console.error('\n⚠️ Démarrage en mode dégradé (sans BDD)');
  }
});

// Gestion des erreurs de pool
pool.on('error', (err, client) => {
  console.error('❌ Erreur inattendue du pool PostgreSQL:', err.message);
  if (err.code === 'ETIMEDOUT') {
    console.error('  ⚠️ Perte de connexion - Tentative de reconnexion automatique...');
  }
});

pool.on('connect', (client) => {
  console.log('🔌 Nouvelle connexion pool établie');
});

pool.on('acquire', (client) => {
  console.log('📥 Connexion acquise du pool');
});

pool.on('remove', (client) => {
  console.log('📤 Connexion retirée du pool');
});

// ============================================
// MIDDLEWARES DE SÉCURITÉ
// ============================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: 'Trop de tentatives de connexion'
});

// ============================================
// BODY PARSER
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// MIDDLEWARE DE LOGGING JWT (AMÉLIORÉ)
// ============================================
app.use((req, res, next) => {
  const timestamp = new Date().toISOString().substring(11, 19);
  
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  console.log('  📍 Origin:', req.headers.origin || 'none');
  console.log('  🔑 Authorization:', req.headers.authorization ? 'Bearer ***' : 'none');
  console.log('  📦 Body:', req.body && Object.keys(req.body).length > 0 ? Object.keys(req.body) : 'empty');
  
  next();
});

// ============================================
// MIDDLEWARE DE VÉRIFICATION BDD
// ============================================
app.use((req, res, next) => {
  // Routes qui ne nécessitent pas de BDD
  const noDbRoutes = ['/', '/health'];
  if (noDbRoutes.includes(req.path)) {
    return next();
  }
  
  // Vérifier que la BDD est accessible
  if (pool.totalCount === 0 && pool.idleCount === 0) {
    console.warn('⚠️ Aucune connexion BDD disponible');
  }
  
  next();
});

// ============================================
// ROUTES
// ============================================

app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API Restaurant - JWT Auth',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    auth: 'JWT',
    version: '2.0.0',
    database: {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    }
  });
});

app.get('/health', async (req, res) => {
  let dbStatus = 'unknown';
  let dbLatency = null;
  
  try {
    const start = Date.now();
    const result = await pool.query('SELECT 1');
    dbLatency = Date.now() - start;
    dbStatus = 'connected';
  } catch (err) {
    console.error('Health check DB error:', err.message);
    dbStatus = 'error: ' + err.message;
  }
  
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    auth: 'JWT',
    database: {
      status: dbStatus,
      latency: dbLatency ? `${dbLatency}ms` : null,
      connections: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    }
  });
});

// Test DB direct
app.get('/test-db', async (req, res) => {
  try {
    const start = Date.now();
    const result = await pool.query('SELECT NOW() as now, version() as version');
    const latency = Date.now() - start;
    
    res.json({
      success: true,
      latency: `${latency}ms`,
      time: result.rows[0].now,
      version: result.rows[0].version,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    });
  } catch (err) {
    console.error('Test DB error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }
});

// Test JWT (protégé)
app.get('/test-jwt', require('./middleware/auths').requireAuth, (req, res) => {
  res.json({
    message: 'JWT valide',
    user: {
      id: req.userId,
      email: req.userEmail,
      role: req.userRole
    }
  });
});

// Routes principales
app.use('/auth', authLimiter, authRoutes);
app.use('/settings', settingsRoutes);
app.use('/users', userRoutes);
app.use('/reservations', reservationRoutes);
app.use('/menus', menusRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/categories', categoriesRoutes);
app.use('/dishes', dishesRoutes);
app.use('/favorites', favoritesRoutes);
app.use('/admin/contact', adminContactRoutes);
app.use('/admin/projects', adminProjectsRoutes);
app.use('/admin/reservations', adminReservationsRoutes);
app.use('/admin/dashboard', adminDashboardRoutes);
app.use('/contact', contactRoutes);

// ============================================
// GESTION ERREURS 404
// ============================================
app.use((req, res) => {
  console.log('❌ 404 - Route non trouvée:', req.method, req.path);
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// ============================================
// GESTION ERREURS GLOBALE (AMÉLIORÉE)
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:');
  console.error('  Message:', err.message);
  console.error('  Code:', err.code);
  console.error('  Path:', req.path);
  console.error('  Method:', req.method);
  
  // Erreurs BDD spécifiques
  if (err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      error: 'Service temporairement indisponible',
      message: 'La base de données ne répond pas',
      code: 'DB_TIMEOUT'
    });
  }
  
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Service temporairement indisponible',
      message: 'Impossible de se connecter à la base de données',
      code: 'DB_CONNECTION_REFUSED'
    });
  }
  
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction 
    ? 'Erreur serveur interne' 
    : err.message;
  
  res.status(err.status || 500).json({ 
    error: errorMessage,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.toString(),
      path: req.path,
      method: req.method,
      code: err.code
    })
  });
});

// ============================================
// DÉMARRAGE SERVEUR
// ============================================
const server = app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log(`║  🚀 Serveur démarré (JWT MODE)       ║`);
  console.log(`║  📍 Port: ${PORT}                      ║`);
  console.log(`║  🌍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(17)}║`);
  console.log(`║  🔐 Auth: JWT Tokens                 ║`);
  console.log(`║  🔗 URL: http://localhost:${PORT}       ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('📍 Routes disponibles:');
  console.log('  GET  / - Status API');
  console.log('  GET  /health - Health check détaillé');
  console.log('  GET  /test-db - Test connexion BDD');
  console.log('  POST /auth/login - Connexion');
  console.log('  POST /auth/register - Inscription');
  console.log('  GET  /settings - Paramètres');
  console.log('');
});

// ============================================
// ARRÊT GRACIEUX
// ============================================
const gracefulShutdown = () => {
  console.log('\n⏳ Arrêt du serveur...');
  
  server.close(() => {
    console.log('✅ Serveur HTTP fermé');
    
    pool.end(() => {
      console.log('✅ Pool DB fermé');
      process.exit(0);
    });
  });
  
  setTimeout(() => {
    console.error('⚠️ Arrêt forcé');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

module.exports = app;
