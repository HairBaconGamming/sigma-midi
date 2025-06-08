// config/db.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const Grid = require('gridfs-stream');
const { GridFsStorage } = require('multer-gridfs-storage');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // useCreateIndex: true, // Không còn cần thiết trong Mongoose 6+
      // useFindAndModify: false, // Không còn cần thiết trong Mongoose 6+
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Init gfs (GridFS Stream) - Cần thiết cho việc đọc file từ GridFS
    // let gfs, gridfsBucket;
    // conn.connection.once('open', () => {
    //   gridfsBucket = new mongoose.mongo.GridFSBucket(conn.connection.db, {
    //     bucketName: 'uploads'
    //   });
    //   gfs = Grid(conn.connection.db, mongoose.mongo);
    //   gfs.collection('uploads'); // 'uploads' là tên collection cho GridFS
    //   console.log('GridFS Initialized.');
    // });
    // return { conn, gfs, gridfsBucket }; // Trả về để có thể sử dụng ở nơi khác nếu cần

  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1); // Thoát khỏi process nếu không kết nối được DB
  }
};


// Tạo storage engine cho Multer với GridFS
const createGridFsStorage = () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI not found in environment variables for GridFS storage.");
  }
  return new GridFsStorage({
    url: process.env.MONGO_URI,
    options: { useNewUrlParser: true, useUnifiedTopology: true },
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads', // Phải khớp với tên collection/bucket bạn dùng
            metadata: { // Thêm metadata tùy chỉnh nếu cần
                originalName: file.originalname,
                uploaderId: req.user ? req.user.id : null, // Gắn uploaderId nếu có user
                title: req.body.title || 'Untitled', // Lấy title từ body request
            }
          };
          resolve(fileInfo);
        });
      });
    }
  });
};


module.exports = { connectDB, createGridFsStorage };