// routes/files.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
// GridFS stream (gfs) và bucket (gridFSBucket) sẽ được lấy từ app.set trong server.js

// @route   GET /api/files/stream/:fileId
// @desc    Stream/Download a file from GridFS by its File ID (_id in fs.files)
// @access  Public
router.get('/stream/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ msg: 'Invalid File ID format.' });
    }

    const gfs = req.app.get('gfs'); // Lấy gfs từ app instance
    const gridFSBucket = req.app.get('gridFSBucket'); // Lấy gridFSBucket

    if (!gfs || !gridFSBucket) {
      console.error('GridFS not initialized on app instance.');
      return res.status(500).send('Server error: File streaming service not ready.');
    }

    // Tìm file metadata trong fs.files collection
    const file = await gfs.files.findOne({ _id: new mongoose.Types.ObjectId(fileId) });

    if (!file || file.length === 0) {
      return res.status(404).json({ msg: 'No file exists with that ID.' });
    }

    // Kiểm tra MIME type (chỉ cho phép MIDI)
    if (file.contentType === 'audio/midi' || file.contentType === 'audio/mid') {
      // Thiết lập header cho download hoặc streaming
      res.set('Content-Type', file.contentType);
      // res.set('Content-Disposition', `attachment; filename="${file.metadata.originalName || file.filename}"`); // Force download
      res.set('Content-Disposition', `inline; filename="${file.metadata.originalName || file.filename}"`); // Suggest browser to display inline if possible, or download

      const readStream = gridFSBucket.openDownloadStream(file._id);
      readStream.on('error', (err) => {
        console.error('GridFS stream error:', err);
        res.status(500).send('Error streaming file.');
      });
      readStream.pipe(res);
    } else {
      res.status(403).json({ msg: 'File type not allowed for streaming.' });
    }
  } catch (err) {
    console.error('Error in /files/stream/:fileId route:', err.message);
    if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
        return res.status(503).send('Database connection error.');
    }
    res.status(500).send('Internal Server Error');
  }
});


// @route   GET /api/files/info/:fileId
// @desc    Get file metadata from GridFS by File ID
// @access  Public (or Private if needed)
router.get('/info/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        if (!mongoose.Types.ObjectId.isValid(fileId)) {
          return res.status(400).json({ msg: 'Invalid File ID format.' });
        }
        const gfs = req.app.get('gfs');
        if (!gfs) return res.status(500).send('File service not ready.');

        const file = await gfs.files.findOne({ _id: new mongoose.Types.ObjectId(fileId) });
        if (!file || file.length === 0) {
          return res.status(404).json({ msg: 'No file exists with that ID.' });
        }
        res.json(file); // Trả về toàn bộ metadata của file từ fs.files
    } catch (err) {
        console.error('Error in /files/info/:fileId route:', err.message);
        res.status(500).send('Internal Server Error');
    }
});


// Optional: Route to delete a file from GridFS by fileId (should be protected)
// router.delete('/:fileId', authMiddleware, async (req, res) => { ... });

module.exports = router;