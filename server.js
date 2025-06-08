// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
// methodOverride có thể không cần thiết nếu bạn chỉ làm API JSON
// const methodOverride = require('method-override');

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth');
const midiRoutes = require('./routes/midis');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "*", // Cho phép từ client URL hoặc tất cả
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'] // Thêm x-auth-token
}));
app.use(express.json({ limit: '1mb' })); // Giảm limit cho JSON, file lớn qua multer
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// app.use(methodOverride('_method'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/midis', midiRoutes);
app.use('/api/files', fileRoutes);

// Serve static assets (React build)
if (process.env.NODE_ENV === 'production' || true) { // Glitch thường chạy ở production
  app.use(express.static('client/dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'dist', 'index.html'));
  });
}

// Global error handler (đặt cuối cùng, sau các routes)
app.use((err, req, res, next) => {
    console.error("[GLOBAL ERROR HANDLER]", err);
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
    await connectDB(); // Đảm bảo kết nối DB hoàn tất

    // Khởi tạo GridFSBucket sau khi Mongoose đã kết nối
    // và lắng nghe sự kiện 'open'
    mongoose.connection.once('open', () => {
      console.log('[SERVER] Mongoose connection "open" event received for GridFSBucket setup.');
      if (mongoose.connection.readyState === 1) {
        const gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
          bucketName: 'uploads' // Phải khớp với bucketName trong GridFsStorage
        });
        app.set('gridFSBucket', gridFSBucket); // Set cho các route khác dùng (ví dụ: files.js)
        console.log('[SERVER] GridFS Bucket Initialized successfully.');
      } else {
        console.error("[SERVER ERROR] Mongoose connection 'open' but readyState is not 1. GridFS Bucket NOT initialized.");
      }
    });

    // Xử lý lỗi kết nối MongoDB sau này (nếu có)
    mongoose.connection.on('error', (err) => {
        console.error("[SERVER ERROR] MongoDB runtime connection error event:", err);
        // Cân nhắc các hành động ở đây, ví dụ: cố gắng kết nối lại, hoặc thông báo lỗi nghiêm trọng
    });

    app.listen(PORT, () => {
      console.log(`[SERVER] Server is running on port ${PORT}`);
      if (!process.env.MONGO_URI) {
        console.warn('[SERVER WARN] MONGO_URI is not set. MongoDB connection will likely fail.');
      }
    });

  } catch (error) { // Lỗi từ lần gọi connectDB() đầu tiên
    console.error("[SERVER FATAL] Failed to initiate MongoDB connection on startup:", error);
    process.exit(1); // Thoát nếu không kết nối được DB khi khởi động
  }
}

startServer();