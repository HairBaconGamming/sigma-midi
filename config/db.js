// config/db.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const { GridFsStorage } = require('multer-gridfs-storage');

let connectionPromise = null; // Promise cho kết nối MongoDB duy nhất

const connectDB = () => {
  if (!connectionPromise) { // Chỉ tạo promise kết nối nếu chưa có
    console.log('[DATABASE] Initiating MongoDB connection...');
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
        // serverSelectionTimeoutMS: 30000, // Tăng timeout nếu cần
        // socketTimeoutMS: 45000,
    })
    .then(conn => {
      console.log(`[DATABASE] MongoDB Connected: ${conn.connection.host} to database: ${conn.connection.name}`);
      mongoose.connection.on('error', err => { // Lắng nghe lỗi sau khi kết nối
        console.error('[DATABASE ERROR] MongoDB connection error after initial connect:', err);
      });
      mongoose.connection.on('disconnected', () => {
        console.warn('[DATABASE WARN] MongoDB disconnected.');
      });
      mongoose.connection.on('reconnected', () => {
        console.log('[DATABASE] MongoDB reconnected.');
      });
      return conn.connection; // Trả về đối tượng connection của Mongoose
    })
    .catch(error => {
      console.error(`[DATABASE FATAL] Could not connect to MongoDB: ${error.message}`);
      connectionPromise = null; // Reset promise để có thể thử lại nếu cần
      throw error; // Ném lỗi ra để server.js có thể bắt
    });
  } else {
    console.log('[DATABASE] MongoDB connection promise already exists. Waiting for it to resolve...');
  }
  return connectionPromise;
};

const createGridFsStorage = () => {
  if (!process.env.MONGO_URI) {
    console.error("[GridFS Storage] MONGO_URI not found.");
    throw new Error("MONGO_URI not found for GridFS storage.");
  }

  const dbPromise = connectDB() // Sử dụng promise kết nối duy nhất
    .then(connection => {
      if (!connection || connection.readyState !== 1 || !connection.db) {
        console.error("[GridFS Storage] Failed to get valid MongoDB Db instance from connection for GridFS.");
        throw new Error("GridFS DB setup failed: Invalid DB instance.");
      }
      console.log("[GridFS Storage] MongoDB Db instance obtained for GridFS.");
      return connection.db; // Đây là native MongoDB Db instance
    })
    .catch(err => {
      console.error("[GridFS Storage] Error obtaining Db instance for GridFS from connectDB promise:", err);
      return Promise.reject(new Error("GridFS DB connection failed via promise: " + err.message));
    });

  return new GridFsStorage({
    db: dbPromise,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) { return reject(err); }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads',
            metadata: {
                originalName: file.originalname,
                uploaderId: req.user ? req.user.id : null,
                title: req.body.title || 'Untitled',
            }
          };
          resolve(fileInfo);
        });
      });
    }
  });
};

module.exports = { connectDB, createGridFsStorage };