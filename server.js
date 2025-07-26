// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb'); // Native driver's GridFSBucket

const { connectDB } = require('./config/db'); // connectDB from your config/db.js
const authRoutes = require('./routes/auth');
const midiRoutes = require('./routes/midis');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 10000; 

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "*", // Allow from client URL or all
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));
app.use(express.json({ limit: '1mb' })); // Limit for JSON payloads
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/midis', midiRoutes);
app.use('/api/files', fileRoutes);

// Serve static assets (React build) in production or similar environments
if (process.env.NODE_ENV === 'production' || true) { // Using 'true' for Glitch-like always-serve
  app.use(express.static('client/dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'dist', 'index.html'));
  });
}

// Global error handler (must be last)
app.use((err, req, res, next) => {
    console.error("[GLOBAL ERROR HANDLER]", err.stack || err); // Log stack for more detail
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    // Avoid sending response if headers already sent (e.g., by a streaming error)
    if (!res.headersSent) {
        res.status(statusCode).json({
            status: 'error',
            statusCode,
            message
        });
    }
});

// Helper function to initialize the app-level GridFSBucket
async function initializeAppGridFSBucket(mongooseConnection) {
    if (!mongooseConnection || mongooseConnection.readyState !== 1) {
        const errMsg = "[SERVER FATAL] Mongoose connection not ready for App GridFSBucket setup.";
        console.error(errMsg, "ReadyState:", mongooseConnection?.readyState);
        throw new Error(errMsg);
    }
    if (!mongooseConnection.client || typeof mongooseConnection.client.db !== 'function') {
        const errMsg = "[SERVER FATAL] Mongoose client or client.db function not available for App GridFSBucket.";
        console.error(errMsg, "Client exists:", !!mongooseConnection.client);
        throw new Error(errMsg);
    }

    const dbName = mongooseConnection.name;
    if (!dbName) {
        const errMsg = "[SERVER FATAL] Mongoose connection name (dbName) is missing. Cannot setup App GridFSBucket.";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    try {
        const nativeDb = mongooseConnection.client.db(dbName); // Get native Db instance
        const appGridFSBucket = new GridFSBucket(nativeDb, {
          bucketName: 'uploads' // Must match bucketName in GridFsStorage config (db.js)
        });
        app.set('gridFSBucket', appGridFSBucket); // Set it on the Express app instance
        console.log('[SERVER] App-level GridFS Bucket Initialized successfully using mongooseConnection.client.db().');
    } catch (error) {
        console.error("[SERVER FATAL] Error initializing App GridFSBucket with nativeDb:", error);
        throw error; // Re-throw to be caught by startServer
    }
}

async function startServer() {
  try {
    console.log('[SERVER] Attempting to connect to MongoDB...');
    // connectDB should return a promise that resolves with the Mongoose connection object
    const mongooseConnection = await connectDB();
    console.log('[SERVER] connectDB promise resolved. Mongoose connection established.');

    // Initialize GridFSBucket for app routes (e.g., file streaming)
    // This relies on the Mongoose connection object being fully ready
    await initializeAppGridFSBucket(mongooseConnection);

    // Start listening for HTTP requests
    app.listen(PORT, () => {
      console.log(`[SERVER] HTTP Server is running on port ${PORT}`);
      if (!process.env.MONGO_URI) { // This check is also in connectDB, but good for visibility
        console.warn('[SERVER WARN] MONGO_URI environment variable is not set.');
      }
      // Check if GridFSBucket for app was set (it should have been by now)
      if (!app.get('gridFSBucket')) {
          console.error("[SERVER CRITICAL] App GridFSBucket was NOT set by the time server started listening. File streaming will fail.");
      } else {
          console.log("[SERVER] App GridFSBucket confirmed set on app instance.");
      }
    });

  } catch (error) {
    // This catches errors from connectDB() or initializeAppGridFSBucket()
    console.error("[SERVER FATAL] Failed to start server due to critical setup error:", error);
    process.exit(1); // Exit if essential services (DB, GridFS) can't start
  }
}

// Listen for Mongoose connection events globally (optional, good for monitoring)
// connectDB() in db.js should already handle its own specific event listeners
// for the GridFS storage used by multer.
mongoose.connection.on('error', (err) => {
    console.error("[SERVER MONGOOSE EVENT] Global Mongoose connection error:", err);
});
mongoose.connection.on('disconnected', () => {
    console.warn('[SERVER MONGOOSE EVENT] Global Mongoose disconnected.');
});
mongoose.connection.on('reconnected', () => {
    console.log('[SERVER MONGOOSE EVENT] Global Mongoose reconnected.');
    // Potentially re-initialize appGridFSBucket if it was lost, though less common
    // if the connection object itself is stable after reconnect.
    if (mongoose.connection.readyState === 1 && !app.get('gridFSBucket')) {
        console.log('[SERVER MONGOOSE EVENT] Attempting to re-initialize App GridFSBucket after reconnect...');
        initializeAppGridFSBucket(mongoose.connection).catch(err => {
            console.error('[SERVER MONGOOSE EVENT] Failed to re-initialize App GridFSBucket after reconnect:', err);
        });
    }
});


startServer();
