// config/db.js
const mongoose = require('mongoose');
const crypto = require('crypto'); // crypto là module built-in, không cần cài riêng
const path = require('path');
const { GridFsStorage } = require('multer-gridfs-storage');

let connectionPromise = null;

const connectDB = () => {
  if (!connectionPromise) {
    console.log('[DATABASE] Initiating MongoDB connection...');
    if (!process.env.MONGO_URI) {
        console.error("[DATABASE FATAL] MONGO_URI is not defined in .env file.");
        // Ném lỗi ở đây sẽ được bắt bởi startServer và thoát ứng dụng
        return Promise.reject(new Error("MONGO_URI is not defined."));
    }
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 6+ không cần useNewUrlParser, useUnifiedTopology
      // serverSelectionTimeoutMS: 30000, // Có thể tăng nếu Glitch kết nối chậm
    })
    .then(mongooseInstance => { // mongoose.connect trả về Mongoose instance
      console.log(`[DATABASE] MongoDB Connected: ${mongooseInstance.connection.host} to database: ${mongooseInstance.connection.name}`);
      
      mongoose.connection.on('error', err => {
        console.error('[DATABASE ERROR] MongoDB connection error after initial connect:', err);
      });
      mongoose.connection.on('disconnected', () => {
        console.warn('[DATABASE WARN] MongoDB disconnected.');
      });
      mongoose.connection.on('reconnected', () => {
        console.log('[DATABASE] MongoDB reconnected.');
      });
      return mongooseInstance.connection; // Trả về đối tượng connection của Mongoose
    })
    .catch(error => {
      console.error(`[DATABASE FATAL] Could not connect to MongoDB: ${error.message}`);
      connectionPromise = null; // Reset để có thể thử lại nếu server restart
      throw error;
    });
  }
  return connectionPromise;
};

const createGridFsStorage = () => {
  if (!process.env.MONGO_URI) {
    console.error("[GridFS Storage] MONGO_URI not found for GridFS storage.");
    // Không nên throw Error ở đây vì nó có thể được gọi khi module được load,
    // trước khi .env được load hoàn toàn trong một số trường hợp.
    // Việc kiểm tra MONGO_URI nên được thực hiện ở connectDB.
  }

  // dbPromise sẽ lấy connection.db từ Mongoose sau khi kết nối thành công
  const dbPromise = connectDB()
    .then(connection => {
      if (!connection || connection.readyState !== 1 || !connection.db) {
        const errMsg = "[GridFS Storage] Failed to get valid MongoDB Db instance from connection for GridFS.";
        console.error(errMsg);
        throw new Error(errMsg); // Ném lỗi để promise bị reject
      }
      console.log("[GridFS Storage] MongoDB Db instance obtained for GridFS.");
      return connection.db; // Đây là native MongoDB Db instance
    })
    .catch(err => {
      console.error("[GridFS Storage] Error obtaining Db instance for GridFS from connectDB promise:", err);
      // Trả về một promise bị reject để multer-gridfs-storage có thể xử lý
      return Promise.reject(new Error("GridFS DB setup failed: " + err.message));
    });

  return new GridFsStorage({
    db: dbPromise, // Cung cấp db promise
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            console.error('[GridFS Storage] Crypto error:', err);
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads', // Phải khớp với bucketName khi tạo GridFSBucket trong server.js
            metadata: { // Metadata này sẽ được lưu vào fs.files
                originalName: file.originalname,
                uploaderId: req.user ? req.user.id.toString() : null, // Đảm bảo là string nếu là ObjectId
                title: req.body.title || 'Untitled',
                contentType: file.mimetype // Lưu mimetype ở đây
            }
          };
          console.log('[GridFS Storage] Resolving fileInfo for GridFS:', fileInfo);
          resolve(fileInfo);
        });
      });
    }
  });
};

module.exports = { connectDB, createGridFsStorage };