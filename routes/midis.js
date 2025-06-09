// routes/midis.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { createGridFsStorage, nativeDbReadyPromise } = require('../config/db'); // Import nativeDbReadyPromise
const authMiddleware = require('../middleware/authMiddleware');
const Midi = require('../models/Midi');
const User = require('../models/User'); // Import User model

let storage; // Declare storage here, will be initialized by middleware
let upload;  // Declare upload here, will be initialized by middleware

// Middleware to ensure GridFS storage is ready for the upload route
const ensureGridFsReadyForUpload = async (req, res, next) => {
    // Only initialize once, or if it failed previously and needs re-attempt
    // For simplicity, this example initializes if 'upload' is not yet defined.
    // A more robust solution might handle re-initialization on errors if needed.
    if (upload) {
        return next(); // Already initialized
    }

    try {
        console.log('[ensureGridFsReadyForUpload] Waiting for nativeDbReadyPromise to resolve before initializing multer...');
        await nativeDbReadyPromise; // Wait for the db connection to be ready for GridFS
        console.log('[ensureGridFsReadyForUpload] nativeDbReadyPromise resolved. Initializing multer storage.');
        
        storage = createGridFsStorage(); // Initialize storage only after db is ready
        
        upload = multer({ // Initialize multer instance
          storage,
          limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
          fileFilter: function (req, file, cb) {
            if (file.mimetype === 'audio/midi' || file.mimetype === 'audio/mid' || file.originalname.match(/\.(mid|midi)$/i)) {
              cb(null, true);
            } else {
              req.fileFilterError = 'Invalid file type. Only MIDI files (.mid, .midi) are allowed.';
              cb(null, false);
            }
          }
        });
        console.log('[ensureGridFsReadyForUpload] Multer initialized for uploads.');
        next();
    } catch (err) {
        console.error('[ensureGridFsReadyForUpload] Error waiting for GridFS DB or initializing multer:', err);
        // This error means the promise from db.js rejected, indicating a fundamental DB setup issue for GridFS.
        res.status(503).json({ msg: 'Server error: File upload system is not ready. Database issue. Please try again later.' });
    }
};

// @route   POST api/midis/upload
// @desc    Upload a MIDI file and save its metadata
// @access  Private
router.post('/upload', authMiddleware, ensureGridFsReadyForUpload, (req, res, next) => {
    if (!upload) {
        // This case should ideally be caught by ensureGridFsReadyForUpload sending a 503
        console.error("[MIDI UPLOAD ROUTE] Critical: 'upload' (multer instance) is not initialized! ensureGridFsReadyForUpload might have failed silently or been bypassed.");
        return res.status(500).json({ msg: 'File upload handler not ready. Configuration error.' });
    }

    upload.single('midiFile')(req, res, async (err) => {
        if (err) {
            console.error("[MIDI UPLOAD ROUTE] Error from multer processing or GridFsStorage:", err);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ msg: 'File too large. Maximum size is 15MB.' });
                }
                return res.status(400).json({ msg: `Multer error: ${err.message}` });
            }
            // This could be an error from GridFsStorage if its internal operations fail
            // (e.g., after the db promise resolved, but subsequent GridFS write failed).
            return res.status(500).json({ msg: `File upload processing error: ${err.message || 'Internal server error during file write.'}` });
        }

        if (req.fileFilterError) {
            return res.status(400).json({ msg: req.fileFilterError });
        }

        if (!req.file) {
            return res.status(400).json({ msg: 'No MIDI file uploaded or file was rejected.' });
        }
        if (!req.body.title) {
            const appGridFSBucket = req.app.get('gridFSBucket');
            if (appGridFSBucket && req.file.id) { // req.file.id comes from multer-gridfs-storage
                try {
                    await appGridFSBucket.delete(new mongoose.Types.ObjectId(req.file.id));
                    console.log(`[Upload Route] Deleted orphaned GridFS file ID: ${req.file.id} due to missing title.`);
                } catch (deleteErr) {
                    console.error("[Upload Route] Error deleting orphaned GridFS file:", deleteErr);
                }
            }
            return res.status(400).json({ msg: 'Title is required.' });
        }

        const { title, artist, description, genre, tags, duration_seconds, key_signature, time_signature,
                difficulty, instrumentation, arrangement_by, bpm, is_public, thumbnail_url } = req.body;

        try {
            const newMidi = new Midi({
                title,
                artist,
                description,
                genre,
                tags: tags ? tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag) : [],
                duration_seconds: duration_seconds ? parseInt(duration_seconds) : undefined,
                key_signature,
                time_signature,
                difficulty: difficulty ? parseInt(difficulty) : undefined,
                instrumentation,
                arrangement_by,
                bpm: bpm ? parseInt(bpm) : undefined,
                uploader: req.user.id,
                fileId: req.file.id, // This is _id of the file in fs.files (or uploads.files)
                filenameGridFs: req.file.filename, // The unique filename generated by GridFsStorage
                original_filename: req.file.metadata.originalName, // From metadata in GridFsStorage's file function
                contentType: req.file.contentType,
                size_bytes: req.file.size,
                is_public: is_public !== undefined ? (String(is_public).toLowerCase() === 'true' || is_public === true || is_public === '1') : true,
                thumbnail_url
            });

            const savedMidi = await newMidi.save();
            // Populate uploader info for the response
            const populatedMidi = await Midi.findById(savedMidi._id).populate('uploader', 'username profile_picture_url');

            res.status(201).json({
                msg: 'MIDI uploaded and metadata saved successfully.',
                midi: populatedMidi,
            });

        } catch (dbErr) {
            console.error("Error saving MIDI metadata after GridFS upload:", dbErr);
            // If metadata save fails, attempt to delete the orphaned file from GridFS
            const appGridFSBucket = req.app.get('gridFSBucket');
            if (appGridFSBucket && req.file && req.file.id) {
                try {
                    await appGridFSBucket.delete(new mongoose.Types.ObjectId(req.file.id));
                    console.log(`[Upload Route] Rolled back GridFS file ID: ${req.file.id} due to metadata save failure.`);
                } catch (deleteErr) {
                    console.error("[Upload Route] Error rolling back GridFS file:", deleteErr);
                }
            }
            if (dbErr.name === 'ValidationError') {
                const messages = Object.values(dbErr.errors).map(val => val.message);
                return res.status(400).json({ msg: messages.join(', ') });
            }
            res.status(500).json({ msg: 'Server error while saving MIDI metadata.' });
        }
    });
});


// @route   GET api/midis
// @desc    Get all public MIDIs with sorting, searching, pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    let {
      sortBy = 'upload_date', order = 'desc', search = '',
      uploaderId, genre, page = 1, limit = 12, difficulty: difficultyFilter
    } = req.query;

    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 12;
    limit = Math.min(limit, 50); // Max limit
    const skip = (page - 1) * limit;

    const query = { is_public: true };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const orConditions = [
        { title: searchRegex },
        { artist: searchRegex },
        { tags: searchRegex },
        { genre: searchRegex },
      ];
      // Search by uploader username
      try {
        const users = await User.find({ username: searchRegex }).select('_id').lean();
        if (users.length > 0) {
          orConditions.push({ uploader: { $in: users.map(u => u._id) } });
        }
      } catch (userSearchErr) {
        console.warn("Error searching users for MIDI query:", userSearchErr.message);
      }
      query.$or = orConditions;
    }

    if (uploaderId) {
        if (mongoose.Types.ObjectId.isValid(uploaderId)) {
            query.uploader = new mongoose.Types.ObjectId(uploaderId);
        } else {
            return res.json({ midis: [], totalItems: 0, totalPages: 0, currentPage: page, itemsPerPage: limit });
        }
    }
    if (genre) {
      query.genre = new RegExp(`^${genre}$`, 'i');
    }
    if (difficultyFilter) {
        const diffNum = parseInt(difficultyFilter);
        if (!isNaN(diffNum) && diffNum >=1 && diffNum <=5) {
            query.difficulty = diffNum;
        }
    }


    const sortOptions = {};
    const validSortFields = ['upload_date', 'title', 'artist', 'views', 'downloads', 'rating_avg', 'difficulty', 'last_updated_date', 'bpm', 'size_bytes'];
    if (validSortFields.includes(sortBy)) {
        sortOptions[sortBy] = (order === 'asc' ? 1 : -1);
    } else {
        sortOptions['upload_date'] = -1; // Default sort
    }


    const totalItems = await Midi.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    const midis = await Midi.find(query)
      .populate('uploader', 'username profile_picture_url')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      midis,
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
    });

  } catch (err) {
    console.error("Error fetching MIDIs:", err.message, err.stack);
    res.status(500).send('Server Error fetching MIDIs');
  }
});


// @route   GET api/midis/:id
// @desc    Get a single MIDI by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ msg: 'Invalid MIDI ID format.' });
    }

    const midi = await Midi.findOne({ _id: req.params.id /* , is_public: true <- Consider if auth users can see their own non-public ones */})
                           .populate('uploader', 'username profile_picture_url');

    if (!midi) {
      return res.status(404).json({ msg: 'MIDI not found.' });
    }

    // Check public status (allow owner/admin to see non-public)
    if (!midi.is_public) {
        const token = req.header('x-auth-token');
        let canViewNonPublic = false;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded.user && (decoded.user.id === midi.uploader._id.toString() /* || user.is_admin - if you have admin role */ )) {
                    canViewNonPublic = true;
                }
            } catch (e) { /* Invalid token, ignore */ }
        }
        if (!canViewNonPublic) {
            return res.status(404).json({ msg: 'MIDI not found or is not public.' });
        }
    }


    // Increment view count (non-blocking)
    Midi.updateOne({ _id: req.params.id }, { $inc: { views: 1 } }).exec().catch(viewErr => {
        console.warn(`Failed to increment view count for MIDI ${req.params.id}:`, viewErr.message);
    });

    res.json(midi);
  } catch (err) {
    console.error("Error fetching MIDI by ID:", err.message, err.stack);
    res.status(500).send('Server Error');
  }
});


// @route   PUT api/midis/:id
// @desc    Update MIDI metadata
// @access  Private (uploader or admin)
router.put('/:id', authMiddleware, async (req, res) => {
    const { title, artist, description, genre, tags, duration_seconds, key_signature, time_signature,
            difficulty, instrumentation, arrangement_by, bpm, is_public, thumbnail_url } = req.body;
    const midiId = req.params.id;
    const userId = req.user.id; // From authMiddleware

    if (!mongoose.Types.ObjectId.isValid(midiId)) {
        return res.status(400).json({ msg: 'Invalid MIDI ID format.' });
    }

    try {
        const midi = await Midi.findById(midiId);
        if (!midi) {
            return res.status(404).json({ msg: 'MIDI not found.' });
        }

        const currentUser = await User.findById(userId).lean(); // Fetch current user for admin check
        if (midi.uploader.toString() !== userId && !(currentUser && currentUser.is_admin)) {
            return res.status(403).json({ msg: 'User not authorized to update this MIDI.' });
        }

        // Update fields if they are provided in the request body
        if (title !== undefined) midi.title = title.trim();
        if (artist !== undefined) midi.artist = artist.trim();
        if (description !== undefined) midi.description = description.trim();
        if (genre !== undefined) midi.genre = genre.trim();
        if (tags !== undefined) midi.tags = Array.isArray(tags) ? tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag) : (tags || '').split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag);
        if (duration_seconds !== undefined) midi.duration_seconds = parseInt(duration_seconds) || null;
        if (key_signature !== undefined) midi.key_signature = key_signature.trim();
        if (time_signature !== undefined) midi.time_signature = time_signature.trim();
        if (difficulty !== undefined) midi.difficulty = parseInt(difficulty) || null;
        if (instrumentation !== undefined) midi.instrumentation = instrumentation.trim();
        if (arrangement_by !== undefined) midi.arrangement_by = arrangement_by.trim();
        if (bpm !== undefined) midi.bpm = parseInt(bpm) || null;
        if (is_public !== undefined) midi.is_public = (String(is_public).toLowerCase() === 'true' || is_public === true || is_public === '1');
        if (thumbnail_url !== undefined) midi.thumbnail_url = thumbnail_url.trim();

        const updatedMidi = await midi.save(); // pre-save hook will update last_updated_date
        const populatedMidi = await Midi.findById(updatedMidi._id).populate('uploader', 'username profile_picture_url').lean();

        res.json(populatedMidi);

    } catch (err) {
        console.error("Error updating MIDI:", err.message, err.stack);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).send('Server error updating MIDI.');
    }
});


// @route   DELETE api/midis/:id
// @desc    Delete a MIDI (metadata and file from GridFS)
// @access  Private (uploader or admin)
router.delete('/:id', authMiddleware, async (req, res) => {
    const midiId = req.params.id;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(midiId)) {
        return res.status(400).json({ msg: 'Invalid MIDI ID format.' });
    }

    try {
        const midi = await Midi.findById(midiId);
        if (!midi) {
            return res.status(404).json({ msg: 'MIDI not found.' });
        }

        const currentUser = await User.findById(userId).lean();
        if (midi.uploader.toString() !== userId && !(currentUser && currentUser.is_admin)) {
            return res.status(403).json({ msg: 'User not authorized to delete this MIDI.' });
        }

        // Delete file from GridFS using the app-level bucket
        const appGridFSBucket = req.app.get('gridFSBucket');
        if (appGridFSBucket && midi.fileId) {
            try {
                await appGridFSBucket.delete(new mongoose.Types.ObjectId(midi.fileId));
                console.log(`GridFS file ${midi.filenameGridFs} (ID: ${midi.fileId}) deleted successfully.`);
            } catch (gridfsErr) {
                if (gridfsErr.message.includes('File not found')) {
                     console.warn(`GridFS file ${midi.filenameGridFs} (ID: ${midi.fileId}) not found for deletion, proceeding to delete metadata.`);
                } else {
                    console.error(`Error deleting GridFS file ${midi.filenameGridFs} (ID: ${midi.fileId}): ${gridfsErr.message}. Metadata deletion will still be attempted.`);
                }
            }
        } else {
            console.warn(`GridFS instance (appGridFSBucket) or midi.fileId not available for MIDI ${midiId}. File may not be deleted from GridFS.`);
        }

        await Midi.deleteOne({ _id: midiId });

        res.json({ msg: 'MIDI deleted successfully.' });

    } catch (err) {
        console.error("Error deleting MIDI:", err.message, err.stack);
        res.status(500).send('Server error deleting MIDI.');
    }
});


// @route   GET api/midis/download-track/:id
// @desc    Track a download (increments count). Actual download is via /api/files/stream/:fileId
// @access  Public
router.get('/download-track/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid MIDI ID format.' });
        }
        const updatedMidi = await Midi.findByIdAndUpdate(
            req.params.id,
            { $inc: { downloads: 1 } },
            { new: true }
        ).lean();

        if (!updatedMidi) {
            return res.status(404).json({ msg: 'MIDI not found to track download.' });
        }
        res.json({ msg: 'Download tracked successfully.', downloads: updatedMidi.downloads });
    } catch (err) {
        console.error("Error tracking MIDI download:", err.message, err.stack);
        res.status(500).send('Server Error');
    }
});


// @route   GET /api/midis/placeholder-thumbnail/:num.png
// @desc    Serves a dynamically generated SVG placeholder thumbnail.
// @access  Public
router.get('/placeholder-thumbnail/:num.png', (req, res) => {
    const num = parseInt(req.params.num) || 0;
    // More diverse colors and a slightly more interesting pattern
    const baseColors = ["#10b981", "#8b5cf6", "#f59e0b", "#3b82f6", "#ec4899", "#6366f1", "#ef4444", "#f97316", "#14b8a6", "#d946ef"];
    const colorIndex = Math.abs(num) % baseColors.length;
    const color = baseColors[colorIndex];

    // Simple gradient background
    const gradientAngle = (num * 17) % 360; // Vary angle
    const colorStop2 = baseColors[(colorIndex + 3) % baseColors.length]; // Pick another color for gradient

    const svg = `
        <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg" viewbox="0 0 320 180">
            <defs>
                <linearGradient id="grad${num}" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${gradientAngle})">
                    <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${colorStop2};stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grad${num})" />
            <text x="50%" y="50%" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#ffffff" text-anchor="middle" dy=".3em" style="paint-order: stroke; stroke: rgba(0,0,0,0.3); stroke-width: 1px;">
                σMIDI
            </text>
             <text x="50%" y="65%" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#f0f0f0" text-anchor="middle" dy=".3em" style="paint-order: stroke; stroke: rgba(0,0,0,0.2); stroke-width: 0.5px;">
                #${num}
            </text>
        </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.send(svg);
});

module.exports = router;