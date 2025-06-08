// midi-sharing-webapp/routes/midis.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage'); // NEW
const crypto = require('crypto'); // For generating unique filenames
const path = require('path');
const axios = require('axios');
const authMiddleware = require('../middleware/authMiddleware');
const { getGfsBucket, getDb } = require('../config/dbMongo'); // NEW
const { ObjectId } = require('mongodb'); // NEW, để làm việc với ID của GridFS

const DATABASE_API_URL = process.env.DATABASE_API_URL; // URL của SQLite metadata API

// Create storage engine for Multer with GridFS
let storage;
if (process.env.MONGO_URI) {
  storage = new GridFsStorage({
    url: process.env.MONGO_URI,
    options: { useNewUrlParser: true, useUnifiedTopology: true }, // Mặc dù có thể không cần với driver mới
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: process.env.GRIDFS_MIDI_BUCKET_NAME || 'midiFilesBucket', // Tên bucket
          };
          resolve(fileInfo);
        });
      });
    }
  });
} else {
  console.warn("MONGO_URI not set. File uploads to GridFS will fail. Using memory storage as fallback (not recommended for production).");
  storage = multer.memoryStorage(); // Fallback, không nên dùng cho production
}


const upload = multer({
  storage: storage,
  limits: { fileSize: 10000000 }, // 10MB
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
}).single('midiFile');

function checkFileType(file, cb) {
  const filetypes = /midi|mid/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: MIDI files only! (.mid, .midi)');
  }
}

// @route   POST api/midis/upload
// @desc    Upload a MIDI file to GridFS and metadata to SQLite API
// @access  Private
router.post('/upload', authMiddleware, (req, res) => {
  if (!process.env.MONGO_URI) {
    return res.status(500).json({ msg: "MongoDB URI not configured. File upload is disabled." });
  }

  upload(req, res, async (err) => {
    if (err) {
      console.error("Multer upload error:", err);
      return res.status(400).json({ msg: err.message || err });
    }
    if (!req.file) {
      return res.status(400).json({ msg: 'Error: No File Selected!' });
    }

    const { title, artist, description, arrangementBy, bpm, genre, tags, duration_seconds, key_signature, time_signature, difficulty, instrumentation, is_public } = req.body;
    const uploaderId = req.user.id;
    const uploaderUsername = req.user.username;

    if (!title) {
      // Nếu thiếu title, xóa file đã upload lên GridFS
      const gfs = getGfsBucket();
      if (gfs && req.file.id) {
        gfs.delete(new ObjectId(req.file.id), (deleteErr) => {
          if (deleteErr) console.error("Error deleting temp GridFS file after validation fail:", deleteErr);
        });
      }
      return res.status(400).json({ msg: 'Title is required' });
    }

    try {
      // Metadata để lưu vào SQLite API
      const midiMetadata = {
        title,
        artist,
        description,
        arrangement_by: arrangementBy,
        bpm: bpm ? parseInt(bpm) : null,
        genre, tags, duration_seconds: duration_seconds ? parseInt(duration_seconds) : null,
        key_signature, time_signature, difficulty: difficulty ? parseInt(difficulty) : null,
        instrumentation,
        uploader_id: uploaderId,
        uploader_username: uploaderUsername,
        original_filename: req.file.originalname,
        // THAY ĐỔI QUAN TRỌNG:
        stored_filename: req.file.filename, // Tên file trong GridFS
        gridfs_file_id: req.file.id.toString(), // ID của file trong GridFS
        file_path: `/api/midis/file/${req.file.id.toString()}/${encodeURIComponent(req.file.filename)}`, // Đường dẫn API để stream file
        size_kb: Math.round(req.file.size / 1024),
        is_public: is_public !== undefined ? (is_public === 'true' || is_public === true || is_public === 1 || is_public === '1') : true,
        // thumbnail_url: // Logic tạo thumbnail nếu có
      };

      // Gọi Database API (SQLite) để lưu metadata
      const response = await axios.post(`${DATABASE_API_URL}/midis`, midiMetadata);

      res.json({
        msg: 'MIDI uploaded and metadata saved.',
        midi: response.data, // Metadata từ DB API (SQLite)
        filePath: midiMetadata.file_path // Đường dẫn API để truy cập file từ GridFS
      });

    } catch (dbErr) {
      console.error("Error saving MIDI metadata to SQLite API:", dbErr.response ? dbErr.response.data : dbErr.message);
      // Xóa file đã upload lên GridFS nếu có lỗi với DB SQLite
      const gfs = getGfsBucket();
      if (gfs && req.file.id) {
        gfs.delete(new ObjectId(req.file.id), (deleteErr) => {
          if (deleteErr) console.error("Error deleting GridFS file after SQLite DB error:", deleteErr);
        });
      }
      res.status(500).json({ msg: 'Server error while saving MIDI metadata' });
    }
  });
});


// @route   GET api/midis/file/:fileId/:filename
// @desc    Stream/Download a MIDI file from GridFS
// @access  Public
router.get('/file/:fileId/:filename?', async (req, res) => {
  const gfs = getGfsBucket();
  if (!gfs) {
    return res.status(500).json({ msg: "GridFS not available." });
  }

  try {
    const fileId = new ObjectId(req.params.fileId);
    const files = await gfs.find({ _id: fileId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ msg: 'No file exists with that ID' });
    }

    const file = files[0];
    // Kiểm tra content type (tùy chọn, nhưng tốt cho MIDI)
    if (file.contentType === 'audio/midi' || file.contentType === 'audio/mid' || file.filename.endsWith('.mid') || file.filename.endsWith('.midi')) {
      // Set header để trình duyệt hiểu là file download hoặc có thể play trực tiếp
      res.set('Content-Type', file.contentType);
      // Sử dụng original_filename nếu có, nếu không dùng filename từ GridFS
      // Để làm điều này, bạn cần query original_filename từ SQLite API dựa trên fileId (gridfs_file_id)
      // Hoặc lưu original_filename vào metadata của GridFS file khi upload (phức tạp hơn với multer-gridfs-storage mặc định)
      // Tạm thời dùng filename từ GridFS:
      const downloadFilename = req.params.filename || file.filename; // filename từ GridFS
      res.set('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      // res.set('Content-Disposition', `inline; filename="${downloadFilename}"`); // Nếu muốn trình duyệt thử mở

      const readstream = gfs.openDownloadStream(fileId);
      readstream.on('error', (err) => {
        console.error("GridFS stream error:", err);
        res.status(500).json({ msg: "Error streaming file." });
      });
      readstream.pipe(res);
    } else {
      res.status(404).json({ msg: 'Not a MIDI file' });
    }
  } catch (err) {
    console.error("Error retrieving file from GridFS:", err);
    if (err.name === "BSONTypeError") {
        return res.status(400).json({ msg: 'Invalid File ID format.' });
    }
    res.status(500).json({ msg: 'Server error retrieving file' });
  }
});


// @route   GET api/midis
// @desc    Get all MIDIs (metadata từ SQLite API)
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Forward request to SQLite metadata API
    const response = await axios.get(`${DATABASE_API_URL}/midis`, { params: req.query });
    res.json(response.data);
  } catch (err) {
    console.error("Error fetching MIDIs from metadata API:", err.response ? err.response.data : err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { msg: 'Server Error fetching MIDIs' });
  }
});

// @route   GET api/midis/:id
// @desc    Get a single MIDI by ID (metadata từ SQLite API)
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const response = await axios.get(`${DATABASE_API_URL}/midis/${req.params.id}`);
    // Tăng view count thông qua SQLite API
    try {
        await axios.put(`${DATABASE_API_URL}/midis/${req.params.id}/view`);
    } catch (viewErr) {
        console.warn("Could not update view count:", viewErr.message);
    }
    res.json(response.data);
  } catch (err) {
    console.error("Error fetching MIDI details from metadata API:", err.response ? err.response.data : err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { msg: 'Server Error fetching MIDI details' });
  }
});


// @route   GET api/midis/download/:id (Metadata ID)
// @desc    Track download and provide GridFS file path info
// @access  Public
router.get('/download/:id', async (req, res) => {
    try {
        const metadataId = req.params.id;
        // 1. Lấy thông tin metadata từ SQLite API để có gridfs_file_id và original_filename
        const midiInfoResponse = await axios.get(`${DATABASE_API_URL}/midis/${metadataId}`);
        if (!midiInfoResponse.data || !midiInfoResponse.data.gridfs_file_id) { // Kiểm tra gridfs_file_id
            return res.status(404).json({ msg: 'MIDI file information or GridFS ID not found in metadata.' });
        }
        const midi = midiInfoResponse.data;

        // 2. Tăng download count thông qua SQLite API
        try {
            await axios.put(`${DATABASE_API_URL}/midis/${metadataId}/download`);
        } catch (downloadCountErr) {
            console.warn("Could not update download count:", downloadCountErr.message);
        }

        // 3. Trả về thông tin để client có thể tạo link download đúng đến GridFS stream route
        res.json({
            msg: "Download tracked. Client should use the provided GridFS stream path.",
            original_filename: midi.original_filename,
            // Đường dẫn này client sẽ dùng để gọi GET /api/midis/file/:gridfs_file_id/:original_filename
            download_path: `/api/midis/file/${midi.gridfs_file_id}/${encodeURIComponent(midi.original_filename || midi.stored_filename)}`
        });

    } catch (err) {
        console.error("Download tracking error:", err.response ? err.response.data : err.message);
        res.status(err.response?.status || 500).json(err.response?.data || { msg: 'Server Error during download tracking process' });
    }
});


// @route   DELETE api/midis/:id (Metadata ID)
// @desc    Delete MIDI metadata from SQLite and file from GridFS
// @access  Private (authMiddleware handles user verification)
router.delete('/:id', authMiddleware, async (req, res) => {
    const metadataId = req.params.id;
    const userId = req.user.id; // User ID từ token

    try {
        // 1. Lấy thông tin MIDI từ SQLite API để kiểm tra uploader và lấy gridfs_file_id
        let midiMetadata;
        try {
            const metaRes = await axios.get(`${DATABASE_API_URL}/midis/${metadataId}`);
            midiMetadata = metaRes.data;
        } catch (e) {
            if (e.response && e.response.status === 404) return res.status(404).json({ msg: 'MIDI metadata not found.' });
            throw e; // Re-throw other errors
        }

        // 2. Kiểm tra quyền (uploader hoặc admin - logic admin cần thêm ở DB API hoặc đây)
        if (midiMetadata.uploader_id !== userId /* && !req.user.isAdmin */) {
            return res.status(403).json({ msg: 'User not authorized to delete this MIDI.' });
        }

        const gridfsFileId = midiMetadata.gridfs_file_id;

        // 3. Xóa file từ GridFS
        if (gridfsFileId) {
            const gfs = getGfsBucket();
            if (gfs) {
                try {
                    await gfs.delete(new ObjectId(gridfsFileId));
                    console.log(`GridFS file ${gridfsFileId} deleted successfully.`);
                } catch (gfsErr) {
                    console.error(`Error deleting GridFS file ${gridfsFileId}:`, gfsErr);
                    // Quyết định có tiếp tục xóa metadata không nếu xóa file lỗi
                    // return res.status(500).json({ msg: 'Failed to delete MIDI file from storage.' });
                }
            }
        } else {
            console.warn(`No GridFS file ID found for metadata ID ${metadataId}. Skipping GridFS deletion.`);
        }

        // 4. Xóa metadata từ SQLite API
        await axios.delete(`${DATABASE_API_URL}/midis/${metadataId}`); // DB API cần hỗ trợ DELETE

        res.json({ msg: 'MIDI deleted successfully from both storage and database.' });

    } catch (err) {
        console.error("Error deleting MIDI:", err.response ? err.response.data : err.message);
        res.status(err.response?.status || 500).json(err.response?.data || { msg: 'Server error during MIDI deletion' });
    }
});


module.exports = router;