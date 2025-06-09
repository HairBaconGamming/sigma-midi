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
        "[Files Route /stream] GridFSBucket not initialized on app instance."
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
      // If not an ObjectId, assume it's a filename (the unique hex name from GridFS)
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

    if (file.contentType === "audio/midi" || file.contentType === "audio/mid" || file.contentType === "application/x-midi") {
      const originalFilename = file.metadata?.originalName || file.filename || 'download.mid';

      res.set('Content-Type', file.contentType);
      res.set('Content-Length', file.length.toString());
      // Use content-disposition for robust filename handling, especially with special characters.
      // 'inline' is suitable for ToneMidi.fromUrl. Use 'attachment' to force download.
      res.set('Content-Disposition', contentDisposition(originalFilename, { type: 'inline' }));
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
          // If headers are sent, the connection might be broken or in an inconsistent state.
          // Destroying the stream is a good measure.
          readStream.destroy();
        }
      });

      readStream.on("end", () => {
        console.log(`[Files Route /stream] Finished streaming ${file.filename}`);
      });

      readStream.pipe(res);
    } else {
      console.warn(`[Files Route /stream] Attempt to stream non-MIDI file: ${file.filename}, type: ${file.contentType}`);
      res
        .status(403)
        .json({
          msg: `File type '${file.contentType}' not allowed for streaming. Only MIDI files are streamable.`,
        });
    }
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


// @route   GET /api/files/info/:fileIdOrFilename  <-- This was the duplicate, now removed.
// The functionality of getting file info is implicitly part of the streaming route if needed,
// or a dedicated info route could be added if just metadata (not the stream) is required.
// For now, removing the duplicate /stream handler is the main fix.

module.exports = router;