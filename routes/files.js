// routes/files.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const contentDisposition = require('content-disposition');

// @route   GET /api/files/stream/:fileIdOrFilename
// @desc    Stream/Download a file from GridFS by its File ID (_id) or filename (random hex name)
// @access  Public
router.get("/stream/:fileIdOrFilename", async (req, res) => {
  try {
    const identifier = req.params.fileIdOrFilename;
    console.log(`[Files Route /stream] Received request for identifier: ${identifier}`); // LOG 1
    const gridFSBucket = req.app.get("gridFSBucket");

    if (!gridFSBucket) {
      console.error("[Files Route /stream] GridFSBucket not initialized on app instance.");
      return res.status(500).send("Server error: File streaming service not ready.");
    }

    let fileCursor;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      console.log(`[Files Route /stream] Identifier is a valid ObjectId. Querying by _id.`); // LOG 2
      fileCursor = gridFSBucket.find({ _id: new mongoose.Types.ObjectId(identifier) });
    } else {
      console.log(`[Files Route /stream] Identifier is NOT an ObjectId. Querying by filename: ${identifier}`); // LOG 3
      fileCursor = gridFSBucket.find({ filename: identifier });
    }

    const files = await fileCursor.toArray();
    if (!files || files.length === 0) {
      console.log(`[Files Route /stream] No file found for identifier: ${identifier}`); // LOG 4
      return res.status(404).json({ msg: "No file exists with that identifier." });
    }
    const file = files[0];
    console.log(`[Files Route /stream] File found: ${file.filename}, contentType: ${file.contentType}, length: ${file.length}`); // LOG 5

    // Kiểm tra contentType
    if (file.contentType === "audio/midi" || file.contentType === "audio/mid") {
      console.log(`[Files Route /stream] Correct contentType. Proceeding to stream.`); // LOG 6
      const originalFilename = file.metadata?.originalName || file.filename || 'download.mid';

      res.set('Content-Type', file.contentType);
      res.set('Content-Length', file.length.toString());
      res.set('Content-Disposition', contentDisposition(originalFilename, { type: 'inline' })); // Hoặc 'attachment' nếu muốn download

      const readStream = gridFSBucket.openDownloadStream(file._id);
      readStream.on("error", (streamErr) => {
        console.error(`[Files Route /stream] GridFS stream error for ${file.filename}:`, streamErr); // LOG 7
        if (!res.headersSent) {
          res.status(500).send("Error streaming file.");
        } else {
          readStream.destroy();
        }
      });
      console.log(`[Files Route /stream] Piping stream for ${file.filename} to response.`); // LOG 8
      readStream.pipe(res);
    } else {
      console.warn(`[Files Route /stream] Incorrect contentType: ${file.contentType} for file ${file.filename}. Denying stream.`); // LOG 9
      res.status(403).json({
          msg: `File type '${file.contentType}' not allowed for streaming. Only MIDI files are streamable.`,
        });
    }
  } catch (err) {
    console.error("[Files Route /stream] General error in route:", err.message, err.stack); // LOG 10
    if (!res.headersSent) {
      if (err.name === "MongoNetworkError" || err.name === "MongooseServerSelectionError") {
        return res.status(503).send("Database connection error.");
      }
      res.status(500).send("Internal Server Error in file stream route.");
    }
  }
});

module.exports = router;