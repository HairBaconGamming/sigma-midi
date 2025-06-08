// config/db.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const { GridFsStorage } = require('multer-gridfs-storage');

const connectDB = async () => {
  // Không cần kiểm tra readyState ở đây nữa, mongoose.connect sẽ tự xử lý hoặc ném lỗi
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {});
    console.log(`[DATABASE] MongoDB Connected: ${conn.connection.host} to database: ${conn.connection.name}`);
    return conn.connection; // Trả về đối tượng connection của Mongoose
  } catch (error) {
    console.error(`[DATABASE ERROR] Error connecting to MongoDB: ${error.message}`);
    // Ném lỗi để server.js có thể bắt và thoát nếu cần
    throw error;
  }
};

const createGridFsStorage = () => {
  if (!process.env.MONGO_URI) {
    console.error("[GridFS Storage] MONGO_URI not found in environment variables.");
    throw new Error("MONGO_URI not found for GridFS storage.");
  }

  // multer-gridfs-storage v5+ có thể lấy db instance từ mongoose.connection
  // sau khi mongoose đã kết nối.
  // Nó cũng có thể chấp nhận một promise trả về db instance.
  const dbPromise = mongoose.connection.readyState === 1
    ? Promise.resolve(mongoose.connection.db) // Nếu đã kết nối, resolve ngay
    : new Promise((resolve, reject) => { // Nếu chưa, đợi sự kiện 'open'
        mongoose.connection.once('open', () => {
            console.log("[GridFS Storage] MongoDB connection opened, providing Db instance for GridFS.");
            resolve(mongoose.connection.db);
        });
        mongoose.connection.once('error', (err) => {
            console.error("[GridFS Storage] MongoDB connection error for GridFS:", err);
            reject(new Error("GridFS DB connection error: " + err.message));
        });
        // Kích hoạt kết nối nếu chưa được gọi ở đâu đó
        if (mongoose.connection.readyState === 0) { // 0 = disconnected
            console.log("[GridFS Storage] Mongoose connection not initiated, attempting connect via connectDB for GridFS.");
            connectDB().catch(reject); // Gọi connectDB và reject nếu nó lỗi
        }
      });


  return new GridFsStorage({
    db: dbPromise, // Cung cấp db promise
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads', // Phải khớp với bucketName khi tạo GridFSBucket
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