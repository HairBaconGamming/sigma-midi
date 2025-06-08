// routes/midis.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { createGridFsStorage } = require('../config/db'); // Storage engine cho GridFS
const authMiddleware = require('../middleware/authMiddleware');
const Midi = require('../models/Midi'); // Import Midi model
const User = require('../models/User'); // Import User model (nếu cần populate)

// Khởi tạo GridFS storage engine MỘT LẦN khi module này được load
// createGridFsStorage() trả về một instance của GridFsStorage
const storage = createGridFsStorage();

const upload = multer({
  storage, // Sử dụng storage engine đã khởi tạo
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'audio/midi' || file.mimetype === 'audio/mid' || file.originalname.match(/\.(mid|midi)$/i)) {
      cb(null, true);
    } else {
      // cb(new Error('Invalid file type...'), false) sẽ truyền lỗi cho error handler của multer
      // Để trả về JSON error, chúng ta có thể dùng req.fileFilterError
      req.fileFilterError = 'Invalid file type. Only MIDI files (.mid, .midi) are allowed.';
      cb(null, false);
    }
  }
});

// Middleware để xử lý lỗi từ fileFilter của Multer
const handleMulterFileFilterError = (req, res, next) => {
    if (req.fileFilterError) {
        return res.status(400).json({ msg: req.fileFilterError });
    }
    next();
};


// @route   POST api/midis/upload
// @desc    Upload a MIDI file and save its metadata
// @access  Private
router.post('/upload', authMiddleware, (req, res, next) => {
    // Gọi middleware của multer một cách thủ công để có thể xử lý lỗi tốt hơn
    upload.single('midiFile')(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            // Lỗi từ Multer (ví dụ: file quá lớn)
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ msg: 'File too large. Maximum size is 15MB.' });
            }
            return res.status(400).json({ msg: `Multer error: ${err.message}` });
        } else if (err) {
            // Lỗi khác (ví dụ từ GridFSStorage file function, hoặc fileFilter ném Error)
            console.error("Unknown error during multer processing or GridFSStorage file function:", err);
            return res.status(500).json({ msg: `File upload processing error: ${err.message}` });
        }

        // Kiểm tra lỗi từ fileFilter (nếu có)
        if (req.fileFilterError) {
            return res.status(400).json({ msg: req.fileFilterError });
        }

        if (!req.file) {
            return res.status(400).json({ msg: 'No MIDI file uploaded or file was rejected.' });
        }
        if (!req.body.title) {
            // Nếu thiếu title, cần xóa file đã upload lên GridFS
            const gridFSBucket = req.app.get('gridFSBucket');
            if (gridFSBucket && req.file.id) {
                try {
                    await gridFSBucket.delete(new mongoose.Types.ObjectId(req.file.id));
                    console.log(`[Upload Route] Deleted orphaned GridFS file ID: ${req.file.id} due to missing title.`);
                } catch (deleteErr) {
                    console.error("[Upload Route] Error deleting orphaned GridFS file:", deleteErr);
                }
            }
            return res.status(400).json({ msg: 'Title is required.' });
        }

        // req.file bây giờ chứa thông tin file từ GridFS (bao gồm id, filename, contentType, size, metadata)
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
                // Thông tin file từ GridFS
                fileId: req.file.id, // Đây là _id của file trong fs.files (hoặc uploads.files)
                filenameGridFs: req.file.filename, // Tên file được tạo bởi GridFsStorage
                original_filename: req.file.metadata.originalName, // Lấy từ metadata đã set trong GridFsStorage
                contentType: req.file.contentType,
                size_bytes: req.file.size,
                is_public: is_public !== undefined ? (String(is_public).toLowerCase() === 'true' || is_public === true || is_public === '1') : true,
                thumbnail_url
            });

            const savedMidi = await newMidi.save();
            const populatedMidi = await Midi.findById(savedMidi._id).populate('uploader', 'username profile_picture_url');

            res.status(201).json({
                msg: 'MIDI uploaded and metadata saved successfully.',
                midi: populatedMidi,
            });

        } catch (err) {
            console.error("Error saving MIDI metadata after GridFS upload:", err.message);
            const gridFSBucket = req.app.get('gridFSBucket');
            if (gridFSBucket && req.file && req.file.id) {
                try {
                    await gridFSBucket.delete(new mongoose.Types.ObjectId(req.file.id));
                    console.log(`[Upload Route] Rolled back GridFS file ID: ${req.file.id} due to metadata save failure.`);
                } catch (deleteErr) {
                    console.error("[Upload Route] Error rolling back GridFS file:", deleteErr);
                }
            }
            if (err.name === 'ValidationError') {
                const messages = Object.values(err.errors).map(val => val.message);
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
    const skip = (page - 1) * limit;

    const query = { is_public: true };

    if (search) {
      const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
      query.$or = [ // Tìm kiếm trên nhiều trường
        { title: searchRegex },
        { artist: searchRegex },
        { tags: searchRegex }, // Nếu tags là mảng string
        { genre: searchRegex },
        // { 'uploader.username': searchRegex } // Cần populate hoặc denormalize username
      ];
      // Nếu muốn search theo uploader username, cần populate hoặc denormalize
      // Hoặc tìm user ID rồi filter theo uploader ID
      const users = await User.find({ username: searchRegex }).select('_id');
      if (users.length > 0) {
        query.$or.push({ uploader: { $in: users.map(u => u._id) } });
      }
    }

    if (req.query.uploaderId) {
        if (mongoose.Types.ObjectId.isValid(req.query.uploaderId)) {
            query.uploader = new mongoose.Types.ObjectId(req.query.uploaderId);
        } else {
            // Handle invalid uploaderId, maybe return empty or error
            return res.json({ midis: [], totalItems: 0, totalPages: 0, currentPage: 1, itemsPerPage: limit });
        }
    }
    if (genre) {
      query.genre = new RegExp(`^${genre}$`, 'i'); // Exact match case-insensitive
    }
    if (difficultyFilter) {
        query.difficulty = parseInt(difficultyFilter);
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
      .populate('uploader', 'username profile_picture_url') // Populate uploader info
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(); // .lean() for faster queries, returns plain JS objects

    res.json({
      midis,
      totalItems,
      totalPages,
      currentPage: page,
      itemsPerPage: limit,
    });

  } catch (err) {
    console.error("Error fetching MIDIs:", err.message);
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

    const midi = await Midi.findOne({ _id: req.params.id, is_public: true })
                           .populate('uploader', 'username profile_picture_url'); // Populate uploader

    if (!midi) {
      return res.status(404).json({ msg: 'MIDI not found or is not public.' });
    }

    // Increment view count (không cần await nếu không gấp)
    Midi.updateOne({ _id: req.params.id }, { $inc: { views: 1 } }).exec();

    res.json(midi);
  } catch (err) {
    console.error("Error fetching MIDI by ID:", err.message);
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
        if (!midi) {
            return res.status(404).json({ msg: 'MIDI not found.' });
        }

        // Check if user is the uploader or an admin
        const user = await User.findById(userId); // Lấy thông tin user hiện tại
        if (midi.uploader.toString() !== userId && !(user && user.is_admin)) {
            return res.status(403).json({ msg: 'User not authorized to update this MIDI.' });
        }

        // Update fields if provided
        if (title !== undefined) midi.title = title;
        if (artist !== undefined) midi.artist = artist;
        if (description !== undefined) midi.description = description;
        if (genre !== undefined) midi.genre = genre;
        if (tags !== undefined) midi.tags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        if (duration_seconds !== undefined) midi.duration_seconds = duration_seconds;
        if (key_signature !== undefined) midi.key_signature = key_signature;
        if (time_signature !== undefined) midi.time_signature = time_signature;
        if (difficulty !== undefined) midi.difficulty = difficulty;
        if (instrumentation !== undefined) midi.instrumentation = instrumentation;
        if (arrangement_by !== undefined) midi.arrangement_by = arrangement_by;
        if (bpm !== undefined) midi.bpm = bpm;
        if (is_public !== undefined) midi.is_public = (is_public === 'true' || is_public === true || is_public === '1');
        if (thumbnail_url !== undefined) midi.thumbnail_url = thumbnail_url;

        const updatedMidi = await midi.save(); // Hook pre-save sẽ cập nhật last_updated_date
        const populatedMidi = await Midi.findById(updatedMidi._id).populate('uploader', 'username profile_picture_url');

        res.json(populatedMidi);

    } catch (err) {
        console.error("Error updating MIDI:", err.message);
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

        const user = await User.findById(userId);
        if (midi.uploader.toString() !== userId && !(user && user.is_admin)) {
            return res.status(403).json({ msg: 'User not authorized to delete this MIDI.' });
        }

        // Delete file from GridFS
        const gfs = req.app.get('gfs');
        const gridFSBucket = req.app.get('gridFSBucket');

        if (gfs && gridFSBucket && midi.fileId) {
            try {
                await gridFSBucket.delete(new mongoose.Types.ObjectId(midi.fileId));
                console.log(`GridFS file ${midi.filenameGridFs} (ID: ${midi.fileId}) deleted.`);
            } catch (gridfsErr) {
                // Log error but proceed to delete metadata, as file might not exist or other issue
                console.error(`Error deleting GridFS file ${midi.filenameGridFs}: ${gridfsErr.message}`);
            }
        } else {
            console.warn(`GridFS instance or fileId not available for MIDI ${midiId}. File may not be deleted from GridFS.`);
        }

        // Delete MIDI metadata from database
        await Midi.deleteOne({ _id: midiId }); // Use deleteOne

        res.json({ msg: 'MIDI deleted successfully (metadata and file).' });

    } catch (err) {
        console.error("Error deleting MIDI:", err.message);
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
            { new: true } // Trả về document đã update
        );
        if (!updatedMidi) {
            return res.status(404).json({ msg: 'MIDI not found to track download.' });
        }
        res.json({ msg: 'Download tracked successfully.', downloads: updatedMidi.downloads });
    } catch (err) {
        console.error("Error tracking MIDI download:", err.message);
        res.status(500).send('Server Error');
    }
});


// Placeholder for thumbnail generation or retrieval (if not just a URL)
// Ví dụ: /api/midis/placeholder-thumbnail/:num.png
// Bạn cần tạo logic để phục vụ ảnh này (ví dụ: tạo SVG động hoặc phục vụ file tĩnh)
router.get('/placeholder-thumbnail/:num.png', (req, res) => {
    const num = parseInt(req.params.num) || 0;
    const colors = ["#10b981", "#8b5cf6", "#f59e0b", "#3b82f6", "#ec4899", "#6366f1"];
    const color = colors[num % colors.length];
    const svg = `
        <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="${color}" />
            <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="20" fill="#fff" text-anchor="middle" dy=".3em">
                sigmaMIDI ${num}
            </text>
        </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
});


// TODO: Routes for Comments, Ratings, Favorites

module.exports = router;