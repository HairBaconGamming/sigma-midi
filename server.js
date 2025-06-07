require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const midiRoutes = require('./routes/midis');

const app = express();
const PORT = process.env.PORT || 3001; // Glitch sẽ set PORT

// Middleware
app.use(cors()); // Cho phép CORS từ mọi origin, tùy chỉnh nếu cần bảo mật hơn
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/midis', midiRoutes);

// Serve static assets (React build) in production
if (process.env.NODE_ENV === 'production' || true) { // Glitch thường chạy ở production mode
  // Set static folder
  app.use(express.static('client/build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Đảm bảo thư mục uploads tồn tại
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
// Route để phục vụ file đã upload (cần thiết cho download)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`DATABASE_API_URL: ${process.env.DATABASE_API_URL}`);
});