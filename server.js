// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const { connectDB } = require('./config/db'); // Chỉ import connectDB
const authRoutes = require('./routes/auth');
const midiRoutes = require('./routes/midis'); // midiRoutes sẽ tự khởi tạo storage engine
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

// Serve static assets (React build)
if (process.env.NODE_ENV === 'production' || true) {
  app.use(express.static('client/dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'dist', 'index.html'));
  });
}

// Hàm để khởi tạo server và các dịch vụ phụ thuộc DB
async function startServer() {
  try {
    await connectDB(); // Đảm bảo kết nối DB hoàn tất trước khi làm gì khác

    // Init gridFSBucket sau khi kết nối MongoDB thành công
    // mongoose.connection là một singleton, nên có thể truy cập ở đây
    if (mongoose.connection.readyState === 1) { // 1 = connected
      const gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads' // Phải khớp với bucketName trong GridFsStorage
      });
      app.set('gridFSBucket', gridFSBucket); // Set cho các route khác dùng
      console.log('[SERVER] GridFS Bucket Initialized for file streaming.');
    } else {
      console.error("[SERVER ERROR] MongoDB connection not ready after connectDB() for GridFS Bucket initialization.");
      // Có thể quyết định thoát ứng dụng ở đây nếu GridFS là thiết yếu
      // process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`[SERVER] Server is running on port ${PORT}`);
      if (!process.env.MONGO_URI) {
        console.warn('[SERVER WARN] MONGO_URI is not set in .env file. MongoDB connection will fail.');
      }
    });

  } catch (error) {
    console.error("[SERVER ERROR] Failed to start server due to MongoDB connection error:", error);
    process.exit(1); // Thoát nếu không kết nối được DB khi khởi động
  }
}

// Bắt đầu server
startServer();