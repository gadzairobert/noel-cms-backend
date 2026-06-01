// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ────────────────────────────────────────────────
// Middleware (order matters)
// ────────────────────────────────────────────────

// 1. CORS (early)
app.use(cors());

// 2. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Serve frontend static files from the correct folder
const frontendPath = path.join(__dirname, '..', 'noel-automotive-repairs');
app.use(express.static(frontendPath));

console.log('Serving frontend static files from:', frontendPath);

// 4. Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────
console.log('Starting route loading...');

const routes = [
  { path: '/api/auth',            file: './routes/auth'             },
  { path: '/api/users',           file: './routes/users'            },
  { path: '/api/customers',       file: './routes/customers'        },
  { path: '/api/services',        file: './routes/services'         },
  { path: '/api/navbar',          file: './routes/navbar'           },
  { path: '/api/social',          file: './routes/social'           },
  { path: '/api/slideshow',       file: './routes/slideshow'        },
  { path: '/api/contact',         file: './routes/contact'          },
  { path: '/api/images',          file: './routes/images'           },
  { path: '/api/testimonials',    file: './routes/testimonials'     },
  { path: '/api/products',        file: './routes/products'         },
  { path: '/api/about',           file: './routes/about'            },
  { path: '/api/logos',           file: './routes/logos'            },
  { path: '/api/quotation_items', file: './routes/quotation_items'  },
  { path: '/api/faq',             file: './routes/faq'              },
  { path: '/api/videos',          file: './routes/videos'           },
  { path: '/api/text_slideshow',  file: './routes/text_slideshow'   },
  { path: '/api/newsletters',     file: './routes/newsletters'      },
  { path: '/api/contact_company', file: './routes/contact_company'  },
  { path: '/api/shop',            file: './routes/shop'             },
  { path: '/api/banking',         file: './routes/banking'          }, // ← Banking Details
];

routes.forEach(({ path, file }) => {
  try {
    console.log(`Loading route: ${path} ...`);
    const router = require(file);
    app.use(path, router);
    console.log(`  → ${path} loaded OK`);
  } catch (err) {
    console.error(`Failed to load route ${path}:`);
    console.error(err.message);
    console.error(err.stack);
  }
});

// ────────────────────────────────────────────────
// SPA Fallback
// ────────────────────────────────────────────────
const indexPath = path.join(frontendPath, 'index.html');
console.log('SPA fallback path:', indexPath);

app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Failed to send index.html:', err);
      res.status(500).json({ message: 'Failed to load frontend' });
    }
  });
});

// ────────────────────────────────────────────────
// Health / test endpoints
// ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    time: new Date().toISOString()
  });
});

// ────────────────────────────────────────────────
// 404 handler (for API only)
// ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    hint: 'Check if the route is mounted in server.js'
  });
});

// ────────────────────────────────────────────────
// Global error handler
// ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global server error:');
  console.error(err.stack);

  const isDev = process.env.NODE_ENV !== 'production';

  res.status(500).json({
    message: 'Internal server error',
    ...(isDev && { error: err.message, stack: err.stack })
  });
});

// ────────────────────────────────────────────────
// Start server
// ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';
const baseUrl = isProd ? 'https://noelautomotiverepaires.com' : `http://localhost:${PORT}`;

app.listen(PORT, () => {
  console.log(`\nServer running → ${baseUrl}`);
  console.log(`Frontend should be at: ${baseUrl}/`);
  console.log(`API base:     ${baseUrl}/api`);
  console.log(`Uploads:      ${baseUrl}/uploads (if exists)`);
  console.log(`Health:       ${baseUrl}/health`);
  console.log('Ready.\n');
});