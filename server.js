// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth');
const midiRoutes = require('./routes/midis');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/midis', midiRoutes);
app.use('/api/files', fileRoutes);

// Serve static assets (React build)
if (process.env.NODE_ENV === 'production' || true) {
  app.use(express.static('client/dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'dist', 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
    console.error("[GLOBAL ERROR HANDLER]", err.stack); // Log stack for more detail
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message
    });
});


async function startServer() {
  try {
    await connectDB(); // connectDB now returns Mongoose connection promise

    // Mongoose connection 'open' event will be handled within db.js for GridFS storage setup.
    // For the GridFSBucket used by app routes (e.g., for streaming), we also wait for 'open'.
    mongoose.connection.once('open', () => {
      console.log('[SERVER] Mongoose connection "open" event received.');
      if (mongoose.connection.readyState === 1 && mongoose.connection.client && typeof mongoose.connection.client.db === 'function') {
        const dbName = mongoose.connection.name;
        if (!dbName) {
            console.error("[SERVER ERROR] GridFSBucket setup: Mongoose connection name (dbName) is missing.");
            return;
        }
        const nativeDb = mongoose.connection.client.db(dbName); // Get native Db instance
        const { GridFSBucket } = require('mongodb'); // Native driver's GridFSBucket

        const appGridFSBucket = new GridFSBucket(nativeDb, {
          bucketName: 'uploads' // Must match bucketName in GridFsStorage config
        });
        app.set('gridFSBucket', appGridFSBucket);
        console.log('[SERVER] App-level GridFS Bucket Initialized successfully for direct operations.');
      } else {
        console.error("[SERVER ERROR] Mongoose connection 'open' but not ready or client.db not available for App GridFS Bucket. State:", mongoose.connection.readyState);
      }
    });

    mongoose.connection.on('error', (err) => {
        console.error("[SERVER ERROR] MongoDB runtime connection error event:", err);
    });

    app.listen(PORT, () => {
      console.log(`[SERVER] Server is running on port ${PORT}`);
      if (!process.env.MONGO_URI) {
        console.warn('[SERVER WARN] MONGO_URI is not set. MongoDB connection will likely fail.');
      }
    });

  } catch (error) {
    console.error("[SERVER FATAL] Failed to initiate MongoDB connection on startup:", error);
    process.exit(1);
  }
}

startServer();