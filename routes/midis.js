// routes/midis.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const jwt = require('jsonwebtoken'); // Cần JWT để xác thực token
const { createGridFsStorage, nativeDbReadyPromise } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const Midi = require('../models/Midi');
const User = require('../models/User');

let storage;
let upload;

const ensureGridFsReadyForUpload = async (req, res, next) => {
    if (upload) {
        return next();
    }
    try {
        await nativeDbReadyPromise;
        storage = createGridFsStorage();
        upload = multer({
          storage,
          limits: { fileSize: 15 * 1024 * 1024 },
          fileFilter: function (req, file, cb) {
            if (file.mimetype === 'audio/midi' || file.mimetype === 'audio/mid' || file.originalname.match(/\.(mid|midi)$/i)) {
              cb(null, true);
            } else {
              req.fileFilterError = 'Invalid file type. Only MIDI files (.mid, .midi) are allowed.';
              cb(null, false);
            }
          }
        });
        next();
    } catch (err) {
        console.error('[ensureGridFsReadyForUpload] Error:', err);
        res.status(503).json({ msg: 'Server error: File upload system is not ready.' });
    }
};

// @route   POST api/midis/upload
// @desc    Upload a MIDI file and save its metadata
// @access  Private
router.post('/upload', authMiddleware, ensureGridFsReadyForUpload, (req, res, next) => {
    if (!upload) {
        return res.status(500).json({ msg: 'File upload handler not ready.' });
    }
    upload.single('midiFile')(req, res, async (err) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ msg: 'File too large. Maximum size is 15MB.' });
            }
            return res.status(500).json({ msg: `File upload processing error: ${err.message}` });
        }
        if (req.fileFilterError) return res.status(400).json({ msg: req.fileFilterError });
        if (!req.file) return res.status(400).json({ msg: 'No MIDI file uploaded or file was rejected.' });
        if (!req.body.title) {
            const appGridFSBucket = req.app.get('gridFSBucket');
            if (appGridFSBucket && req.file.id) {
                try { await appGridFSBucket.delete(new mongoose.Types.ObjectId(req.file.id)); } catch (delErr) { console.error("Error deleting orphaned GridFS file:", delErr); }
            }
            return res.status(400).json({ msg: 'Title is required.' });
        }

        const { title, artist, description, genre, tags, duration_seconds, key_signature, time_signature,
                difficulty, instrumentation, arrangement_by, bpm, is_public, thumbnail_url } = req.body;
        try {
            const newMidi = new Midi({
                title, artist, description, genre,
                tags: tags ? tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag) : [],
                duration_seconds: duration_seconds ? parseInt(duration_seconds) : undefined,
                key_signature, time_signature,
                difficulty: difficulty ? parseInt(difficulty) : undefined,
                instrumentation, arrangement_by,
                bpm: bpm ? parseInt(bpm) : undefined,
                uploader: req.user.id,
                fileId: req.file.id,
                filenameGridFs: req.file.filename,
                original_filename: req.file.metadata?.originalName || req.file.originalname,
                contentType: req.file.contentType, // Nên được set đúng bởi GridFsStorage
                size_bytes: req.file.size,
                is_public: is_public !== undefined ? (String(is_public).toLowerCase() === 'true' || is_public === true || is_public === '1') : true,
                thumbnail_url
            });
            const savedMidi = await newMidi.save();
            const populatedMidi = await Midi.findById(savedMidi._id).populate('uploader', 'username profile_picture_url _id');
            res.status(201).json({ msg: 'MIDI uploaded successfully.', midi: populatedMidi });
        } catch (dbErr) {
            console.error("Error saving MIDI metadata:", dbErr);
            const appGridFSBucket = req.app.get('gridFSBucket');
            if (appGridFSBucket && req.file && req.file.id) {
                try { await appGridFSBucket.delete(new mongoose.Types.ObjectId(req.file.id)); } catch (delErr) { console.error("Error rolling back GridFS file:", delErr); }
            }
            if (dbErr.name === 'ValidationError') return res.status(400).json({ msg: Object.values(dbErr.errors).map(val => val.message).join(', ') });
            res.status(500).json({ msg: 'Server error while saving MIDI metadata.' });
        }
    });
});

// @route   GET api/midis
// @desc    Get MIDIs with sorting, searching, pagination
// @access  Public (with special handling for owner's private MIDIs)
router.get('/', async (req, res) => {
  try {
    let {
      sortBy = 'upload_date', order = 'desc', search = '',
      uploaderId, genre, page = 1, limit = 12, difficulty: difficultyFilter
    } = req.query;

    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 12;
    limit = Math.min(limit, 50);
    const skip = (page - 1) * limit;

    const query = {}; // Bắt đầu với query rỗng

    // Mặc định chỉ lấy public, trừ khi là chủ sở hữu xem MIDI của mình
    let isOwnerViewingOwnMidis = false;
    if (uploaderId) {
        if (mongoose.Types.ObjectId.isValid(uploaderId)) {
            query.uploader = new mongoose.Types.ObjectId(uploaderId);
            const token = req.header('x-auth-token');
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    if (decoded.user && decoded.user.id === uploaderId) {
                        isOwnerViewingOwnMidis = true;
                    }
                } catch (e) { console.warn("[GET /api/midis] Token verification failed for owner check:", e.message); }
            }
        } else {
            // Invalid uploaderId format, return empty
            return res.json({ midis: [], totalItems: 0, totalPages: 0, currentPage: page, itemsPerPage: limit });
        }
    }

    if (!isOwnerViewingOwnMidis) {
        query.is_public = true; // Chỉ lấy public nếu không phải chủ sở hữu xem của mình
    }
    // Nếu isOwnerViewingOwnMidis là true, query.is_public sẽ không được set, nghĩa là lấy cả public và private

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const orConditions = [
        { title: searchRegex }, { artist: searchRegex },
        { tags: searchRegex }, { genre: searchRegex },
      ];
      try {
        const users = await User.find({ username: searchRegex }).select('_id').lean();
        if (users.length > 0) {
          orConditions.push({ uploader: { $in: users.map(u => u._id) } });
        }
      } catch (userSearchErr) { console.warn("Error searching users for MIDI query:", userSearchErr.message); }
      query.$or = orConditions;
    }

    if (genre) query.genre = new RegExp(`^${genre}$`, 'i');
    if (difficultyFilter) {
        const diffNum = parseInt(difficultyFilter);
        if (!isNaN(diffNum) && diffNum >=1 && diffNum <=5) query.difficulty = diffNum;
    }

    const sortOptions = {};
    const validSortFields = ['upload_date', 'title', 'artist', 'views', 'downloads', 'rating_avg', 'difficulty', 'last_updated_date', 'bpm', 'size_bytes'];
    sortOptions[validSortFields.includes(sortBy) ? sortBy : 'upload_date'] = (order === 'asc' ? 1 : -1);

    console.log(`[GET /api/midis] Final query:`, JSON.stringify(query));
    const totalItems = await Midi.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    const midis = await Midi.find(query)
      .populate('uploader', 'username profile_picture_url _id') // QUAN TRỌNG: populate _id
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ midis, totalItems, totalPages, currentPage: page, itemsPerPage: limit });

  } catch (err) {
    console.error("Error fetching MIDIs:", err.message, err.stack);
    res.status(500).send('Server Error fetching MIDIs');
  }
});


// @route   GET api/midis/:id
// @desc    Get a single MIDI by ID
// @access  Public (with owner/admin override for private)
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ msg: 'Invalid MIDI ID format.' });
    }
    console.log(`[GET MIDI Detail] Request for MIDI ID: ${req.params.id}`);

    // Tìm MIDI mà không cần điều kiện is_public ban đầu
    const midi = await Midi.findById(req.params.id)
                           .populate('uploader', 'username profile_picture_url _id'); // QUAN TRỌNG: populate _id

    if (!midi) {
      console.log(`[GET MIDI Detail] MIDI ID ${req.params.id} not found in database.`);
      return res.status(404).json({ msg: 'MIDI not found.' });
    }
    console.log(`[GET MIDI Detail] Found MIDI: ${midi.title}, is_public: ${midi.is_public}, uploader_id: ${midi.uploader?._id}`);

    // Kiểm tra quyền truy cập nếu MIDI không public
    if (!midi.is_public) {
        const token = req.header('x-auth-token');
        let canViewNonPublic = false;
        console.log(`[GET MIDI Detail] MIDI is private. Checking token: ${token ? 'Found' : 'Not Found'}`);

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                console.log(`[GET MIDI Detail] Decoded user ID from token: ${decoded.user?.id}`);
                if (decoded.user && midi.uploader && midi.uploader._id && decoded.user.id === midi.uploader._id.toString()) {
                    canViewNonPublic = true;
                    console.log(`[GET MIDI Detail] User is owner. Setting canViewNonPublic to true.`);
                }
                // Optional: Add admin check here if you have an admin role in your token/user model
                // else if (decoded.user && decoded.user.is_admin) {
                //   canViewNonPublic = true;
                //   console.log(`[GET MIDI Detail] User is admin. Setting canViewNonPublic to true.`);
                // }
            } catch (e) {
                console.warn(`[GET MIDI Detail] Invalid token or token verification error: ${e.message}`);
            }
        }
        if (!canViewNonPublic) {
            console.log(`[GET MIDI Detail] User cannot view non-public MIDI. Returning 404.`);
            return res.status(404).json({ msg: 'MIDI not found or is not public.' });
        }
        console.log(`[GET MIDI Detail] User can view non-public MIDI. Proceeding.`);
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
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(midiId)) {
        return res.status(400).json({ msg: 'Invalid MIDI ID format.' });
    }
    try {
        const midi = await Midi.findById(midiId);
        if (!midi) return res.status(404).json({ msg: 'MIDI not found.' });

        // const currentUser = await User.findById(userId).lean(); // Chỉ cần nếu có logic admin
        if (midi.uploader.toString() !== userId /* && !(currentUser && currentUser.is_admin) */) {
            return res.status(403).json({ msg: 'User not authorized to update this MIDI.' });
        }

        if (title !== undefined) midi.title = title.trim();
        if (artist !== undefined) midi.artist = artist.trim();
        if (description !== undefined) midi.description = description.trim();
        if (genre !== undefined) midi.genre = genre.trim();
        if (tags !== undefined) midi.tags = Array.isArray(tags) ? tags.map(tag => tag.trim().toLowerCase()).filter(Boolean) : (tags || '').split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
        if (duration_seconds !== undefined) midi.duration_seconds = parseInt(duration_seconds) || null;
        if (key_signature !== undefined) midi.key_signature = key_signature.trim();
        if (time_signature !== undefined) midi.time_signature = time_signature.trim();
        if (difficulty !== undefined) midi.difficulty = parseInt(difficulty) || null;
        if (instrumentation !== undefined) midi.instrumentation = instrumentation.trim();
        if (arrangement_by !== undefined) midi.arrangement_by = arrangement_by.trim();
        if (bpm !== undefined) midi.bpm = parseInt(bpm) || null;
        if (is_public !== undefined) midi.is_public = (String(is_public).toLowerCase() === 'true' || is_public === true || is_public === '1');
        if (thumbnail_url !== undefined) midi.thumbnail_url = thumbnail_url.trim();

        const updatedMidi = await midi.save();
        const populatedMidi = await Midi.findById(updatedMidi._id).populate('uploader', 'username profile_picture_url _id').lean();
        res.json(populatedMidi);
    } catch (err) {
        console.error("Error updating MIDI:", err.message, err.stack);
        if (err.name === 'ValidationError') return res.status(400).json({ msg: Object.values(err.errors).map(val => val.message).join(', ') });
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
        if (!midi) return res.status(404).json({ msg: 'MIDI not found.' });

        // const currentUser = await User.findById(userId).lean(); // Chỉ cần nếu có logic admin
        if (midi.uploader.toString() !== userId /* && !(currentUser && currentUser.is_admin) */) {
            return res.status(403).json({ msg: 'User not authorized to delete this MIDI.' });
        }

        const appGridFSBucket = req.app.get('gridFSBucket');
        if (appGridFSBucket && midi.fileId) {
            try {
                await appGridFSBucket.delete(new mongoose.Types.ObjectId(midi.fileId));
                console.log(`GridFS file ${midi.filenameGridFs} (ID: ${midi.fileId}) deleted.`);
            } catch (gridfsErr) {
                if (gridfsErr.message.includes('File not found')) console.warn(`GridFS file ID: ${midi.fileId} not found for deletion.`);
                else console.error(`Error deleting GridFS file ID: ${midi.fileId}: ${gridfsErr.message}.`);
            }
        }
        await Midi.deleteOne({ _id: midiId });
        res.json({ msg: 'MIDI deleted successfully.' });
    } catch (err) {
        console.error("Error deleting MIDI:", err.message, err.stack);
        res.status(500).send('Server error deleting MIDI.');
    }
});


// @route   GET api/midis/download-track/:id
// @desc    Track a download
// @access  Public
router.get('/download-track/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ msg: 'Invalid MIDI ID format.' });
        }
        const updatedMidi = await Midi.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } }, { new: true }).lean();
        if (!updatedMidi) return res.status(404).json({ msg: 'MIDI not found to track download.' });
        res.json({ msg: 'Download tracked successfully.', downloads: updatedMidi.downloads });
    } catch (err) {
        console.error("Error tracking MIDI download:", err.message);
        res.status(500).send('Server Error');
    }
});


// @route   GET /api/midis/placeholder-thumbnail/:num.png
// @desc    Serves a dynamically generated SVG placeholder thumbnail.
// @access  Public
router.get('/placeholder-thumbnail/:num.png', (req, res) => {
    const num = parseInt(req.params.num) || 0;
    const baseColors = ["#10b981", "#8b5cf6", "#f59e0b", "#3b82f6", "#ec4899", "#6366f1", "#ef4444", "#f97316", "#14b8a6", "#d946ef"];
    const colorIndex = Math.abs(num) % baseColors.length;
    const color = baseColors[colorIndex];
    const gradientAngle = (num * 17) % 360;
    const colorStop2 = baseColors[(colorIndex + 3) % baseColors.length];
    const svg = `
        <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg" viewbox="0 0 320 180">
            <defs>
                <linearGradient id="grad${num}" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${gradientAngle})">
                    <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${colorStop2};stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grad${num})" />
            <text x="50%" y="50%" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#ffffff" text-anchor="middle" dy=".3em" style="paint-order: stroke; stroke: rgba(0,0,0,0.3); stroke-width: 1px;">σMIDI</text>
            <text x="50%" y="65%" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#f0f0f0" text-anchor="middle" dy=".3em" style="paint-order: stroke; stroke: rgba(0,0,0,0.2); stroke-width: 0.5px;">#${num}</text>
        </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(svg);
});

module.exports = router;