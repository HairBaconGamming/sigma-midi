const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const authMiddleware = require('../middleware/authMiddleware');

const DATABASE_API_URL = process.env.DATABASE_API_URL;

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Thư mục lưu file tạm thời
  },
  filename: function (req, file, cb) {
    // Tạo tên file duy nhất để tránh trùng lặp
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10000000 }, // Giới hạn 10MB
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
}).single('midiFile'); // 'midiFile' là tên của field trong form data

function checkFileType(file, cb) {
  const filetypes = /midi|mid/; // Chấp nhận .midi hoặc .mid
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: MIDI files only! (.mid, .midi)');
  }
}

// @route   POST api/midis/upload
// @desc    Upload a MIDI file
// @access  Private
router.post('/upload', authMiddleware, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ msg: err });
    }
    if (req.file == undefined) {
      return res.status(400).json({ msg: 'Error: No File Selected!' });
    }

    const { title, artist, description, arrangementBy, bpm } = req.body;
    const uploaderId = req.user.id; // Từ authMiddleware
    const uploaderUsername = req.user.username; // Từ authMiddleware

    if (!title) {
        // Xóa file đã upload nếu thiếu thông tin
        fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
        });
        return res.status(400).json({ msg: 'Title is required' });
    }

    try {
      const midiData = {
        title,
        artist: artist || 'Unknown Artist',
        description: description || '',
        arrangement_by: arrangementBy || '',
        bpm: bpm ? parseInt(bpm) : null,
        uploader_id: uploaderId,
        uploader_username: uploaderUsername,
        original_filename: req.file.originalname,
        stored_filename: req.file.filename, // Tên file đã lưu trên server này
        file_path: `/uploads/${req.file.filename}`, // Đường dẫn để truy cập file
        size_kb: Math.round(req.file.size / 1024),
        // upload_date sẽ được set bởi DB API
      };

      // Gọi Database API để lưu metadata
      const response = await axios.post(`${DATABASE_API_URL}/midis`, midiData);
      res.json({
        msg: 'MIDI uploaded successfully',
        midi: response.data, // Metadata từ DB API
        filePath: `/uploads/${req.file.filename}` // Trả về đường dẫn file trên server này
      });

    } catch (dbErr) {
      console.error("Error saving MIDI metadata to DB API:", dbErr.message);
      if (dbErr.response) console.error("DB API Response:", dbErr.response.data);
       // Xóa file đã upload nếu có lỗi với DB
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting temp file after DB error:", unlinkErr);
      });
      res.status(500).json({ msg: 'Server error while saving MIDI metadata' });
    }
  });
});

// @route   GET api/midis
// @desc    Get all MIDIs
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { sortBy = 'upload_date', order = 'desc', search = '' } = req.query;
    const response = await axios.get(`${DATABASE_API_URL}/midis`, {
        params: { sortBy, order, search }
    });
    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error fetching MIDIs');
  }
});

// @route   GET api/midis/:id
// @desc    Get a single MIDI by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const response = await axios.get(`${DATABASE_API_URL}/midis/${req.params.id}`);
    // Tăng view count
    await axios.put(`${DATABASE_API_URL}/midis/${req.params.id}/view`);
    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    if (err.response && err.response.status === 404) {
        return res.status(404).json({ msg: 'MIDI not found' });
    }
    res.status(500).send('Server Error fetching MIDI details');
  }
});

// @route   GET api/midis/download/:id
// @desc    Technically, the client will use the file_path. This is more for tracking.
//          Actual download is handled by serving static files from /uploads
// @access  Public
router.get('/download/:id', async (req, res) => {
    try {
        // Lấy thông tin file từ DB API để có stored_filename
        const midiInfoResponse = await axios.get(`${DATABASE_API_URL}/midis/${req.params.id}`);
        if (!midiInfoResponse.data || !midiInfoResponse.data.stored_filename) {
            return res.status(404).json({ msg: 'MIDI file information not found.' });
        }

        const midi = midiInfoResponse.data;
        const filePath = path.join(__dirname, '..', 'uploads', midi.stored_filename);

        if (fs.existsSync(filePath)) {
            // Tăng download count
            await axios.put(`${DATABASE_API_URL}/midis/${req.params.id}/download`);
            // res.download(filePath, midi.original_filename); // Gửi file cho client download
            // Hoặc chỉ cần xác nhận và client tự download qua static path
             res.json({
                msg: "Download tracked. Client should use static path.",
                original_filename: midi.original_filename,
                download_path: `/uploads/${midi.stored_filename}`
            });
        } else {
            res.status(404).json({ msg: 'File not found on server.' });
        }
    } catch (err) {
        console.error("Download tracking/file serving error:", err.message);
        if (err.response && err.response.status === 404) {
            return res.status(404).json({ msg: 'MIDI not found in database for download tracking.' });
        }
        res.status(500).send('Server Error during download process');
    }
});


module.exports = router;