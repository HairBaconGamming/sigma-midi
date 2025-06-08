// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path =require('path');
const mongoose = require('mongoose');

const { connectDB } = require('./config/db'); // Chỉ cần connectDB
const authRoutes = require('./routes/auth');
const midiRoutes = require('./routes/midis');
const fileRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/midis', midiRoutes);
app.use('/api/files', fileRoutes);

// Serve static assets
if (process.env.NODE_ENV === 'production' || true) {
  app.use(express.static('client/dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'dist', 'index.html'));
  });
}

async function startServer() {
  try {
    // Gọi connectDB để đảm bảo promise kết nối được tạo và bắt đầu
    // Hàm này sẽ trả về promise của kết nối
    await connectDB();

    // Lắng nghe sự kiện 'open' một lần duy nhất trên mongoose.connection
    // để khởi tạo GridFSBucket sau khi Mongoose xác nhận kết nối đã mở.
    mongoose.connection.once('open', () => {
      console.log('[SERVER] Mongoose connection "open" event received.');
      if (mongoose.connection.readyState === 1) { // Double check readyState
        const gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
          bucketName: 'uploads'
        });
        app.set('gridFSBucket', gridFSBucket);
        console.log('[SERVER] GridFS Bucket Initialized successfully.');
      } else {
        console.error("[SERVER ERROR] Mongoose connection 'open' but readyState is not 1. GridFS Bucket NOT initialized.");
      }
    });

    // Xử lý trường hợp lỗi kết nối sau khi đã cố gắng kết nối
    mongoose.connection.on('error', (err) => {
        console.error("[SERVER ERROR] MongoDB connection error event:", err);
        // Có thể cần xử lý thêm ở đây, ví dụ: không cho server start nếu lỗi này xảy ra trước khi 'open'
    });


    app.listen(PORT, () => {
      console.log(`[SERVER] Server is running on port ${PORT}`);
      if (!process.env.MONGO_URI) {
        console.warn('[SERVER WARN] MONGO_URI is not set. MongoDB connection will likely fail.');
      }
    });

  } catch (error) { // Lỗi từ lần gọi connectDB() đầu tiên (ví dụ: MONGO_URI sai)
    console.error("[SERVER FATAL] Failed to initiate MongoDB connection on startup:", error);
    process.exit(1);
  }
}

startServer();