// config/db.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const { GridFsStorage } = require('multer-gridfs-storage');
// We will try to get the Db class constructor from Mongoose's client

let mongooseConnectionPromise = null;
let nativeDbForGridFS = null;
let resolveNativeDbPromise = null;
let rejectNativeDbPromise = null;

// A promise that resolves once nativeDbForGridFS is set
const nativeDbReadyPromise = new Promise((resolve, reject) => {
    resolveNativeDbPromise = resolve;
    rejectNativeDbPromise = reject; // Store the reject function
});

const connectDB = () => {
  if (!mongooseConnectionPromise) {
    console.log('[DATABASE] Initiating MongoDB connection...');
    if (!process.env.MONGO_URI) {
      const errMsg = "[DATABASE FATAL] MONGO_URI is not defined in .env file.";
      console.error(errMsg);
      if (rejectNativeDbPromise) rejectNativeDbPromise(new Error(errMsg)); // Reject the GridFS promise
      return Promise.reject(new Error(errMsg));
    }

    const conn = mongoose.connection;

    conn.on('error', err => {
      console.error('[DATABASE ERROR] MongoDB connection error:', err);
      nativeDbForGridFS = null;
      if (rejectNativeDbPromise) { // Check if reject function exists
        // Avoid rejecting if promise already settled
        nativeDbReadyPromise.catch(() => {}).finally(() => rejectNativeDbPromise(err));
      }
    });

    conn.on('disconnected', () => {
      console.warn('[DATABASE WARN] MongoDB disconnected.');
      nativeDbForGridFS = null;
    });

    conn.on('reconnected', () => {
      console.log('[DATABASE] MongoDB reconnected.');
      try {
        const dbName = conn.name;
        if (conn.client && typeof conn.client.db === 'function' && dbName) {
            const tempDb = conn.client.db(dbName);
            // Dynamically get the Db class constructor from Mongoose's client
            const MongodbNativeDbClass = conn.client.constructor.Db || (tempDb && Object.getPrototypeOf(tempDb).constructor);

            if (tempDb && MongodbNativeDbClass && tempDb instanceof MongodbNativeDbClass) {
                nativeDbForGridFS = tempDb;
                console.log('[DATABASE] Native Db instance for GridFS RE-CAPTURED after reconnect.');
                if (resolveNativeDbPromise && nativeDbForGridFS) {
                    resolveNativeDbPromise(nativeDbForGridFS); // Re-resolve or handle as needed
                }
            } else {
                console.error('[DATABASE] Recaptured conn.client.db() is NOT a valid Db instance after reconnect.');
            }
        } else {
            console.error('[DATABASE] Cannot recapture native Db instance after reconnect (client or dbName missing).');
        }
      } catch (e) {
          console.error('[DATABASE] Error recapturing native Db after reconnect:', e)
      }
    });

    conn.once('open', () => {
      console.log(`[DATABASE] Mongoose connection 'open' event fired. DB Name from conn: ${conn.name}`);
      try {
        const dbName = conn.name;
        if (!dbName) {
            const errMsg = '[DATABASE] "open" event fired, but conn.name (database name) is missing.';
            console.error(errMsg);
            if (rejectNativeDbPromise) rejectNativeDbPromise(new Error(errMsg));
            return;
        }

        if (conn.client && typeof conn.client.db === 'function') {
          const tempDb = conn.client.db(dbName);
          // Dynamically get the Db class constructor from Mongoose's client
          // This is crucial because require('mongodb').Db might be a different version/instance
          const MongodbNativeDbClass = conn.client.constructor.Db || // Ideal path
                                       (tempDb && Object.getPrototypeOf(tempDb) ? Object.getPrototypeOf(tempDb).constructor : null); // Fallback

          if (tempDb && MongodbNativeDbClass && tempDb instanceof MongodbNativeDbClass) {
            nativeDbForGridFS = tempDb;
            console.log('[DATABASE] Native Db instance for GridFS CAPTURED successfully via conn.client.db().');
            if (resolveNativeDbPromise) {
              resolveNativeDbPromise(nativeDbForGridFS);
            }
          } else {
            const errMsg = `[DATABASE] "open" event, conn.client.db() did NOT return a valid Db instance according to Mongoose's client's Db class.`;
            console.error(errMsg, 'tempDb constructor:', tempDb ? tempDb.constructor.name : 'N/A', 'Expected Db constructor:', MongodbNativeDbClass ? MongodbNativeDbClass.name : 'N/A');
            console.error('Logged tempDb structure (first 1000 chars):', JSON.stringify(tempDb, null, 2).substring(0, 1000) + "...");
            if (rejectNativeDbPromise) {
              rejectNativeDbPromise(new Error(errMsg));
            }
          }
        } else {
          const errMsg = '[DATABASE] "open" event, but conn.client or conn.client.db is not available/valid.';
          console.error(errMsg, 'conn.client exists:', !!conn.client, 'typeof conn.client.db:', typeof conn.client?.db);
          if (rejectNativeDbPromise) {
            rejectNativeDbPromise(new Error(errMsg));
          }
        }
      } catch(e) {
          const errMsg = '[DATABASE] Exception during "open" event native Db capture: ' + e.message;
          console.error(errMsg, e);
          if (rejectNativeDbPromise) {
            rejectNativeDbPromise(new Error(errMsg));
          }
      }
    });

    mongooseConnectionPromise = mongoose.connect(process.env.MONGO_URI)
      .then(mongooseInstance => {
        console.log(`[DATABASE] mongoose.connect() promise resolved. Host: ${mongooseInstance.connection.host}, DB Name: ${mongooseInstance.connection.name}`);
        // The 'open' event listener above is now primarily responsible for setting nativeDbForGridFS
        return mongooseInstance.connection;
      })
      .catch(error => {
        console.error(`[DATABASE FATAL] Could not connect to MongoDB (mongoose.connect catch): ${error.message}`);
        mongooseConnectionPromise = null;
        nativeDbForGridFS = null;
        if (rejectNativeDbPromise) rejectNativeDbPromise(error);
        throw error;
      });
  }
  return mongooseConnectionPromise;
};

const createGridFsStorage = () => {
  if (!process.env.MONGO_URI) {
    const errMsg = "[GridFS Storage Config] MONGO_URI not found. GridFS storage cannot be initialized.";
    console.error(errMsg);
    // Return a mock storage that will immediately fail, as GridFsStorage constructor expects a db or url
    return { 
        _handleFile: (req, file, cb) => cb(new Error(errMsg)),
        _removeFile: (req, file, cb) => cb()
    };
  }

  // Ensure connectDB is called to initiate connection and set up event listeners
  connectDB().catch(err => {
    console.error("[GridFS Storage Config] Initial connectDB() call failed:", err.message);
    // The nativeDbReadyPromise will likely be rejected by connectDB's error handling
  });

  console.log("[GridFS Storage Config] GridFsStorage configured to wait for nativeDbReadyPromise.");

  return new GridFsStorage({
    db: nativeDbReadyPromise, // Pass the promise that waits for nativeDbForGridFS to be set
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            console.error('[GridFS Storage File Fn] Crypto error:', err);
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads', // Must match bucketName in server.js GridFSBucket setup
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

module.exports = { connectDB, createGridFsStorage, nativeDbReadyPromise };