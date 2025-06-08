// midi-sharing-webapp/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const midiRoutes = require('./routes/midis');
const { connectToServer } = require('./config/dbMongo'); // NEW

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB and then start the server
connectToServer((err) => {
  if (err) {
    console.error("Failed to connect to MongoDB. Server not started.");
    return;
  }

  // Middleware (sau khi kết nối DB thành công)
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/midis', midiRoutes); // midiRoutes sẽ được cập nhật để dùng GridFS

  // Serve static assets (React build)
  if (process.env.NODE_ENV === 'production' || true) {
    app.use(express.static('client/build'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
    });
  }

  // Không cần thư mục uploads vật lý nữa nếu dùng GridFS
  // const fs = require('fs');
  // const uploadsDir = path.join(__dirname, 'uploads');
  // if (!fs.existsSync(uploadsDir)) {
  //   fs.mkdirSync(uploadsDir);
  // }
  // app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Route này sẽ bị thay thế

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`DATABASE_API_URL (SQLite Meta): ${process.env.DATABASE_API_URL}`);
    console.log(`MongoDB URI (Files): ${process.env.MONGO_URI ? 'Configured' : 'NOT CONFIGURED'}`);
  });
});