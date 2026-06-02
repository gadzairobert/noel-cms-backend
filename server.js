// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ── Global Error Handlers (Must be at the very top) ─────────────────────
process.on('uncaughtException', (err) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', err);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
});

// ── Initialize Express ─────────────────────────────────────────────────
const app = express();
const isProd = process.env.NODE_ENV === 'production';

// ── CORS ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://noelautomotiverepaires.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  credentials: true,
}));

// ── Body parsers ───────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static uploads folder ──────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health Check ───────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    time: new Date().toISOString(),
    environment: isProd ? 'production' : 'development',
  });
});

// ── Test Database Connection ───────────────────────────────────────────
app.get('/api/test-db', async (req, res) => {
  try {
    const db = require('./config/db'); // Adjust path if your db connection is elsewhere
    const [rows] = await db.query('SELECT 1 as connected');
    res.json({ 
      status: 'Database connected successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({ 
      status: 'Database connection failed',
      error: error.message 
    });
  }
});

// ── API Routes ─────────────────────────────────────────────────────────
const routes = [
  { path: '/api/auth',            file: './routes/auth'            },
  { path: '/api/users',           file: './routes/users'           },
  { path: '/api/customers',       file: './routes/customers'       },
  { path: '/api/services',        file: './routes/services'        },
  { path: '/api/navbar',          file: './routes/navbar'          },
  { path: '/api/social',          file: './routes/social'          },
  { path: '/api/slideshow',       file: './routes/slideshow'       },
  { path: '/api/contact',         file: './routes/contact'         },
  { path: '/api/images',          file: './routes/images'          },
  { path: '/api/testimonials',    file: './routes/testimonials'    },
  { path: '/api/products',        file: './routes/products'        },
  { path: '/api/about',           file: './routes/about'           },
  { path: '/api/logos',           file: './routes/logos'           },
  { path: '/api/quotation_items', file: './routes/quotation_items' },
  { path: '/api/faq',             file: './routes/faq'             },
  { path: '/api/videos',          file: './routes/videos'          },
  { path: '/api/text_slideshow',  file: './routes/text_slideshow'  },
  { path: '/api/newsletters',     file: './routes/newsletters'     },
  { path: '/api/contact_company', file: './routes/contact_company' },
  { path: '/api/shop',            file: './routes/shop'            },
  { path: '/api/banking',         file: './routes/banking'         },
];

routes.forEach(({ path, file }) => {
  try {
    app.use(path, require(file));
    console.log(`  ✓ Loaded route: ${path}`);
  } catch (err) {
    console.error(`  ✗ Failed to load ${path}:`, err.message);
  }
});

// ── 404 Handler for API routes ─────────────────────────────────────────
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ 
      message: `Route not found: ${req.method} ${req.originalUrl}` 
    });
  }
  next();
});

// ── Global Error Handler ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global Error:', err.stack);
  res.status(500).json({
    message: 'Internal server error',
    ...( !isProd && { error: err.message, stack: err.stack } )
  });
});

// ── Start Server ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;   // ← Changed default to 8080

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${isProd ? 'Production' : 'Development'}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});