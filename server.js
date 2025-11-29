// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth');
const midiRoutes = require('./routes/midis');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 10000; 

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

// --- PHỤC VỤ FRONTEND (Thay thế Vite) ---
// Phục vụ các file tĩnh (JS, CSS, Images) từ thư mục client/dist
app.use(express.static(path.join(__dirname, 'client/dist')));

// Tất cả các request không phải API sẽ trả về file index.html (cho React Router hoạt động)
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'client', 'dist', 'index.html'));
});
// ----------------------------------------

// Global error handler
app.use((err, req, res, next) => {
    console.error("[GLOBAL ERROR HANDLER]", err.stack || err);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    if (!res.headersSent) {
        res.status(statusCode).json({
            status: 'error',
            statusCode,
            message
        });
    }
});

// Helper function to initialize App GridFSBucket
async function initializeAppGridFSBucket(mongooseConnection) {
    if (!mongooseConnection || mongooseConnection.readyState !== 1) {
        throw new Error("[SERVER FATAL] Mongoose connection not ready.");
    }
    const dbName = mongooseConnection.name;
    const nativeDb = mongooseConnection.client.db(dbName);
    const appGridFSBucket = new GridFSBucket(nativeDb, {
        bucketName: 'uploads'
    });
    app.set('gridFSBucket', appGridFSBucket);
    console.log('[SERVER] App-level GridFS Bucket Initialized.');
}

async function startServer() {
  try {
    console.log('[SERVER] Attempting to connect to MongoDB...');
    const mongooseConnection = await connectDB();
    console.log('[SERVER] Connected to MongoDB.');

    await initializeAppGridFSBucket(mongooseConnection);

    app.listen(PORT, () => {
      console.log(`[SERVER] HTTP Server is running on port ${PORT}`);
      console.log(`[SERVER] Serving Client from client/dist`);
    });

  } catch (error) {
    console.error("[SERVER FATAL] Failed to start server:", error);
    process.exit(1);
  }
}

mongoose.connection.on('error', (err) => console.error("[MONGOOSE] Error:", err));
mongoose.connection.on('disconnected', () => console.warn('[MONGOOSE] Disconnected.'));

startServer();
