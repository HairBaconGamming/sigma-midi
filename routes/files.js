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
    const gridFSBucket = req.app.get("gridFSBucket");

    if (!gridFSBucket) {
      console.error(
        "[Files Route] GridFSBucket not initialized on app instance."
      );
      return res
        .status(500)
        .send("Server error: File streaming service not ready.");
    }

    let fileCursor;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      fileCursor = gridFSBucket.find({
        _id: new mongoose.Types.ObjectId(identifier),
      });
    } else {
      // Nếu không phải ObjectId, coi nó là filename (tên file trong GridFS)
      fileCursor = gridFSBucket.find({ filename: identifier });
    }

    const files = await fileCursor.toArray();
    if (!files || files.length === 0) {
      return res
        .status(404)
        .json({ msg: "No file exists with that identifier." });
    }
    const file = files[0];

    if (file.contentType === "audio/midi" || file.contentType === "audio/mid") {
      const originalFilename = file.metadata?.originalName || file.filename || 'download.mid';

      res.set('Content-Type', file.contentType);
      res.set('Content-Length', file.length.toString());

      // Use the content-disposition library to generate the header correctly
      // It handles quoting and encoding for UTF-8 characters.
      // The `type` can be 'inline' or 'attachment'.
      res.set('Content-Disposition', contentDisposition(originalFilename, { type: 'inline' }));

      const readStream = gridFSBucket.openDownloadStream(file._id);
      readStream.on("error", (streamErr) => {
        console.error("[Files Route] GridFS stream error:", streamErr);
        // Tránh gửi response nếu header đã được gửi
        if (!res.headersSent) {
          res.status(500).send("Error streaming file.");
        } else {
          readStream.destroy(); // Hủy stream nếu lỗi xảy ra giữa chừng
        }
      });
      readStream.pipe(res);
    } else {
      res
        .status(403)
        .json({
          msg: `File type '${file.contentType}' not allowed for streaming.`,
        });
    }
  } catch (err) {
    console.error(
      "[Files Route] Error in /stream/:fileIdOrFilename:",
      err.message
    );
    if (!res.headersSent) {
      if (
        err.name === "MongoNetworkError" ||
        err.name === "MongooseServerSelectionError"
      ) {
        return res.status(503).send("Database connection error.");
      }
      res.status(500).send("Internal Server Error");
    }
  }
});

// @route   GET /api/files/info/:fileIdOrFilename
// @desc    Get file metadata from GridFS by File ID or filename
// @access  Public (or Private if needed)
router.get("/stream/:fileIdOrFilename", async (req, res) => {
  try {
    const identifier = req.params.fileIdOrFilename;
    const gridFSBucket = req.app.get("gridFSBucket"); // THIS IS THE APP-LEVEL BUCKET

    if (!gridFSBucket) {
      console.error(
        "[Files Route /stream] GridFSBucket NOT INITIALIZED on app instance."
      );
      return res
        .status(500)
        .send("Server error: File streaming service not ready.");
    }
    console.log(
      `[Files Route /stream] Attempting to stream file with identifier: ${identifier}`
    );

    let fileCursor;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      fileCursor = gridFSBucket.find({
        _id: new mongoose.Types.ObjectId(identifier),
      });
    } else {
      // This branch is less likely used if you always pass fileId (ObjectId) from frontend
      fileCursor = gridFSBucket.find({ filename: identifier });
    }

    const files = await fileCursor.toArray();
    if (!files || files.length === 0) {
      console.log(
        `[Files Route /stream] No file found for identifier: ${identifier}`
      );
      return res
        .status(404)
        .json({ msg: "No file exists with that identifier." });
    }
    const file = files[0];
    console.log(
      `[Files Route /stream] File found: ${file.filename}, contentType: ${file.contentType}, length: ${file.length}`
    );

    // Set necessary headers for streaming and correct MIME type
    res.set("Content-Type", file.contentType);
    res.set("Content-Length", file.length.toString()); // Important for some clients
    // For ToneMidi.fromUrl, 'inline' is fine. 'attachment' would force download.
    res.set(
      "Content-Disposition",
      `inline; filename="${file.metadata?.originalName || file.filename}"`
    );
    // Allow cross-origin requests if Tone.js is on a different conceptual origin (though usually not for /api)
    // res.set('Access-Control-Allow-Origin', '*'); // Already handled by global CORS, but for direct test

    const readStream = gridFSBucket.openDownloadStream(file._id);

    readStream.on("data", (chunk) => {
      // console.log(`[Files Route /stream] Sending chunk for ${file.filename}`); // Can be very verbose
    });

    readStream.on("error", (streamErr) => {
      console.error(
        `[Files Route /stream] GridFS stream error for file ${file.filename} (ID: ${file._id}):`,
        streamErr
      );
      if (!res.headersSent) {
        res.status(500).send("Error streaming file.");
      } else {
        readStream.destroy();
      }
    });

    readStream.on("end", () => {
      console.log(`[Files Route /stream] Finished streaming ${file.filename}`);
    });

    readStream.pipe(res);
  } catch (err) {
    console.error(
      "[Files Route /stream] General error:",
      err.message,
      err.stack
    );
    if (!res.headersSent) {
      if (
        err.name === "MongoNetworkError" ||
        err.name === "MongooseServerSelectionError"
      ) {
        return res.status(503).send("Database connection error.");
      }
      res.status(500).send("Internal Server Error in file stream route.");
    }
  }
});

module.exports = router;
