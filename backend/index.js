require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

const { initializeDatabase } = require('./db/schema');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const censusRoutes = require('./routes/census');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const verifyRoutes = require('./routes/verify');

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082'],
  credentials: true,
}));

// Compression middleware
app.use(compression());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/', (req, res) => {
  res.json({ status: 'Census API is running', timestamp: new Date().toISOString() });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initializeDatabase();
    console.log('Database initialized');

    // Register routes
    app.use('/api/auth', authRoutes);
    app.use('/api/census', censusRoutes);
    app.use('/api/ai', aiRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/verify', verifyRoutes);

    // Error handling middleware (must be last)
    app.use(errorHandler);

    app.listen(port, () => {
      console.log(`✓ Census API listening on port ${port}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();