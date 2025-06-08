// routes/files.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// @route   GET /api/files/stream/:fileIdOrFilename
// @desc    Stream/Download a file from GridFS by its File ID (_id) or filename (random hex name)
// @access  Public
router.get('/stream/:fileIdOrFilename', async (req, res) => {
  try {
    const identifier = req.params.fileIdOrFilename;
    const gridFSBucket = req.app.get('gridFSBucket');

    if (!gridFSBucket) {
      console.error('[Files Route] GridFSBucket not initialized on app instance.');
      return res.status(500).send('Server error: File streaming service not ready.');
    }

    let fileCursor;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      fileCursor = gridFSBucket.find({ _id: new mongoose.Types.ObjectId(identifier) });
    } else {
      // Nếu không phải ObjectId, coi nó là filename (tên file trong GridFS)
      fileCursor = gridFSBucket.find({ filename: identifier });
    }

    const files = await fileCursor.toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ msg: 'No file exists with that identifier.' });
    }
    const file = files[0]; // Lấy file đầu tiên tìm thấy

    if (file.contentType === 'audio/midi' || file.contentType === 'audio/mid') {
      res.set('Content-Type', file.contentType);
      // Sử dụng originalName từ metadata nếu có, nếu không thì filename từ GridFS
      const downloadFilename = file.metadata?.originalName || file.filename;
      res.set('Content-Disposition', `inline; filename="${downloadFilename}"`);
      // res.set('Content-Disposition', `attachment; filename="${downloadFilename}"`); // Để luôn luôn download

      const readStream = gridFSBucket.openDownloadStream(file._id);
      readStream.on('error', (streamErr) => {
        console.error('[Files Route] GridFS stream error:', streamErr);
        // Tránh gửi response nếu header đã được gửi
        if (!res.headersSent) {
            res.status(500).send('Error streaming file.');
        } else {
            readStream.destroy(); // Hủy stream nếu lỗi xảy ra giữa chừng
        }
      });
      readStream.pipe(res);
    } else {
      res.status(403).json({ msg: `File type '${file.contentType}' not allowed for streaming.` });
    }
  } catch (err) {
    console.error('[Files Route] Error in /stream/:fileIdOrFilename:', err.message);
    if (!res.headersSent) {
        if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
            return res.status(503).send('Database connection error.');
        }
        res.status(500).send('Internal Server Error');
    }
  }
});

// @route   GET /api/files/info/:fileIdOrFilename
// @desc    Get file metadata from GridFS by File ID or filename
// @access  Public (or Private if needed)
router.get('/info/:fileIdOrFilename', async (req, res) => {
    try {
        const identifier = req.params.fileIdOrFilename;
        const filesCollection = mongoose.connection.db.collection('uploads.files'); // Hoặc 'fs.files'
        
        let file;
        if (mongoose.Types.ObjectId.isValid(identifier)) {
          file = await filesCollection.findOne({ _id: new mongoose.Types.ObjectId(identifier) });
        } else {
          file = await filesCollection.findOne({ filename: identifier });
        }

        if (!file) {
          return res.status(404).json({ msg: 'No file metadata exists with that identifier.' });
        }
        res.json(file);
    } catch (err) {
        console.error('[Files Route] Error in /info/:fileIdOrFilename:', err.message);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;