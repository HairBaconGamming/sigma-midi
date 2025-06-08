// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose'); // Thêm Mongoose
const multer = require('multer'); // Thêm Multer
const methodOverride = require('method-override'); // Nếu cần
const Grid = require('gridfs-stream'); // Thêm Grid

const { connectDB, createGridFsStorage } = require('./config/db'); // Import hàm kết nối và storage
const authRoutes = require('./routes/auth');
const midiRoutes = require('./routes/midis');
const fileRoutes = require('./routes/files'); 
// const fileRoutes = require('./routes/files'); // NEW: Route để phục vụ file từ GridFS

const app = express();

// Kết nối MongoDB
connectDB();

// Init gfs and gridFSBucket for file streaming
let gfs, gridFSBucket;
const conn = mongoose.connection;
conn.once('open', () => {
  gridFSBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads' // Tên bucket/collection trong GridFS
  });
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
  console.log('GridFS Initialized for file streaming.');
  // Make gfs and gridFSBucket available to routes
  app.set('gfs', gfs);
  app.set('gridFSBucket', gridFSBucket);
});


const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method')); // Nếu dùng method override

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  if (!process.env.MONGO_URI) {
    console.warn('MONGO_URI is not set in .env file. MongoDB connection will fail.');
  }
});