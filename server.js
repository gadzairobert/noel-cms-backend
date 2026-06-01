// server.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app    = express();
const isProd = process.env.NODE_ENV === 'production';

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://noelautomotiverepaires.com',
    'http://localhost:3000',
  ],
  credentials: true,
}));

// ── Body parsers ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Uploads folder ────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    time:   new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────
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
    console.log(`  ✓ ${path}`);
  } catch (err) {
    console.error(`  ✗ Failed to load ${path}:`, err.message);
  }
});

// ── 404 for unknown API routes ────────────────────────────
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
  }
  next();
});

// ── Global error handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal server error',
    ...(!isProd && { error: err.message }),
  });
});

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});