// config/db.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = 'path'; // Error here: 'path' is a string, not the module. Should be: require('path');
const { GridFsStorage } = require('multer-gridfs-storage');
const { Db } = require('mongodb'); // Keep for instanceof check

let mongooseConnectionPromise = null;
let nativeDbForGridFS = null; // Store the native Db instance once available

const connectDB = () => {
  if (!mongooseConnectionPromise) {
    console.log('[DATABASE] Initiating MongoDB connection...');
    if (!process.env.MONGO_URI) {
      console.error("[DATABASE FATAL] MONGO_URI is not defined in .env file.");
      return Promise.reject(new Error("MONGO_URI is not defined."));
    }
    mongooseConnectionPromise = mongoose.connect(process.env.MONGO_URI)
      .then(mongooseInstance => {
        const conn = mongooseInstance.connection;
        console.log(`[DATABASE] MongoDB Connected: ${conn.host} to database: ${conn.name}`);
        
        // Store the native Db instance once connected for GridFS
        if (conn.db && conn.db instanceof Db) {
          nativeDbForGridFS = conn.db;
          console.log('[DATABASE] Native Db instance for GridFS captured.');
        } else {
          console.error('[DATABASE] Failed to capture native Db instance from Mongoose connection. GridFS might fail.');
        }

        conn.on('error', err => {
          console.error('[DATABASE ERROR] MongoDB connection error after initial connect:', err);
          nativeDbForGridFS = null; // Invalidate on error
        });
        conn.on('disconnected', () => {
          console.warn('[DATABASE WARN] MongoDB disconnected.');
          nativeDbForGridFS = null; // Invalidate on disconnect
        });
        conn.on('reconnected', () => {
          console.log('[DATABASE] MongoDB reconnected.');
          if (mongoose.connection.db && mongoose.connection.db instanceof Db) {
             nativeDbForGridFS = mongoose.connection.db; // Recapture on reconnect
             console.log('[DATABASE] Native Db instance for GridFS recaptured after reconnect.');
          }
        });
        return conn; // Return Mongoose connection object
      })
      .catch(error => {
        console.error(`[DATABASE FATAL] Could not connect to MongoDB: ${error.message}`);
        mongooseConnectionPromise = null;
        nativeDbForGridFS = null;
        throw error;
      });
  }
  return mongooseConnectionPromise;
};

const createGridFsStorage = () => {
  if (!process.env.MONGO_URI) {
    console.error("[GridFS Storage Config] MONGO_URI not found. GridFS storage will likely fail.");
    // Return a mock/failing storage instance
    return { 
        _handleFile: (req, file, cb) => cb(new Error("MONGO_URI not configured for GridFS")),
        _removeFile: (req, file, cb) => cb()
    };
  }

  // This promise will resolve to the native Db object for GridFS *after* Mongoose connects.
  const dbPromiseForGridFS = new Promise((resolve, reject) => {
    connectDB() // Ensure Mongoose connection is initiated
      .then(() => {
        // Wait for nativeDbForGridFS to be set. This might involve a slight delay.
        // A more robust way might be to emit an event from connectDB when nativeDbForGridFS is ready.
        // For now, let's try a small timeout or check interval.
        if (nativeDbForGridFS) {
          console.log("[GridFS Storage Config] Using pre-captured native Db instance.");
          resolve(nativeDbForGridFS);
        } else {
          // If not immediately available, listen to the 'open' event on the Mongoose connection
          // This ensures we only proceed once the connection is truly open and db object is available
          const conn = mongoose.connection;
          if (conn.readyState === 1 && conn.db && conn.db instanceof Db) { // Already open
            console.log("[GridFS Storage Config] Mongoose connection already open, using its db object.");
            nativeDbForGridFS = conn.db; // Ensure it's set
            resolve(conn.db);
          } else {
            console.log("[GridFS Storage Config] Mongoose connection not yet fully open. Waiting for 'open' event...");
            conn.once('open', () => {
              if (conn.db && conn.db instanceof Db) {
                console.log("[GridFS Storage Config] Mongoose 'open' event fired. Using its db object.");
                nativeDbForGridFS = conn.db; // Ensure it's set
                resolve(conn.db);
              } else {
                const errMsg = "[GridFS Storage Config] Mongoose 'open' event, but Db object is invalid.";
                console.error(errMsg, conn.db);
                reject(new Error(errMsg));
              }
            });
            conn.once('error', (err) => { // Also handle error during this waiting period
                console.error("[GridFS Storage Config] Error on Mongoose connection while waiting for 'open':", err);
                reject(new Error("Mongoose connection error while waiting for GridFS Db: " + err.message));
            });
          }
        }
      })
      .catch(err => {
        console.error("[GridFS Storage Config] Error from connectDB() while setting up dbPromiseForGridFS:", err);
        reject(new Error("Failed to connect to DB for GridFS: " + err.message));
      });
  });

  return new GridFsStorage({
    db: dbPromiseForGridFS, // Pass the promise that resolves to the Mongoose connection's native db
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            console.error('[GridFS Storage File Fn] Crypto error:', err);
            return reject(err);
          }
          const filename = buf.toString('hex') + require('path').extname(file.originalname); // Corrected path usage
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads',
            metadata: {
              originalName: file.originalname,
              uploaderId: req.user ? req.user.id.toString() : null,
              title: req.body.title || file.originalname.replace(/\.[^/.]+$/, "") || 'Untitled',
              contentType: file.mimetype
            }
          };
          resolve(fileInfo);
        });
      });
    }
  });
};

module.exports = { connectDB, createGridFsStorage };