// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Import User model
const authMiddleware = require('../middleware/authMiddleware'); // Giữ nguyên middleware này

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res.status(400).json({ msg: 'Please enter username and password' });
  }
  if (password.length < 6) {
    return res.status(400).json({ msg: 'Password must be at least 6 characters' });
  }

  try {
    let user = await User.findOne({ username: username.toLowerCase() });
    if (user) {
      return res.status(400).json({ msg: 'Username already exists' });
    }
    if (email) {
        let emailUser = await User.findOne({ email: email.toLowerCase() });
        if (emailUser) {
            return res.status(400).json({ msg: 'Email already registered' });
        }
    }


    user = new User({
      username,
      password,
      email: email ? email.toLowerCase() : undefined,
    });

    await user.save(); // Password sẽ được hash bởi pre-save hook trong model

    const payload = {
      user: {
        id: user.id, // Hoặc user._id tùy Mongoose trả về
        username: user.username,
        // is_admin: user.is_admin // Có thể thêm quyền vào token
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5d' }, // Token hết hạn sau 5 ngày
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin } // Trả về thông tin user cơ bản
        });
      }
    );
  } catch (err) {
    console.error("Register error:", err.message);
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({ msg: messages.join(', ') });
    }
    res.status(500).send('Server error during registration');
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
   if (!username || !password) {
    return res.status(400).json({ msg: 'Please enter username and password' });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase() }).select('+password'); // Lấy cả password để so sánh
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Cập nhật last_login_date (không cần await nếu không gấp)
    user.last_login_date = Date.now();
    await user.save({ validateBeforeSave: false }); // Bỏ qua validation khi chỉ cập nhật last_login

    const payload = {
      user: {
        id: user.id,
        username: user.username,
        // is_admin: user.is_admin
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin }
        });
      }
    );
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/auth/me
// @desc    Get current logged-in user data (profile)
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // req.user.id được set bởi authMiddleware
    const user = await User.findById(req.user.id).select('-password'); // Loại bỏ password
    if (!user) {
        return res.status(404).json({ msg: 'User not found' });
    }
    // Có thể thêm logic để lấy số lượng MIDI đã upload, etc.
    // const midiCount = await Midi.countDocuments({ uploader: user.id });
    // res.json({ ...user.toObject(), midiUploadCount: midiCount });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// NEW: Route để lấy profile công khai của user khác (nếu cần)
router.get('/profile/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('username profile_picture_url bio registration_date'); // Chỉ lấy thông tin public
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        // const midiCount = await Midi.countDocuments({ uploader: user.id, is_public: true });
        // res.json({ ...user.toObject(), midiUploadCount: midiCount });
        res.json(user);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'User not found (invalid ID format)' });
        }
        res.status(500).send('Server Error');
    }
});


// NEW: Route để cập nhật profile của user đang login
router.put('/me/profile', authMiddleware, async (req, res) => {
    const { bio, profile_picture_url /*, other fields */ } = req.body;
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        if (bio !== undefined) user.bio = bio;
        if (profile_picture_url !== undefined) user.profile_picture_url = profile_picture_url;
        // Cập nhật các trường khác nếu có

        const updatedUser = await user.save();
        res.json({
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            bio: updatedUser.bio,
            profile_picture_url: updatedUser.profile_picture_url,
            is_admin: updatedUser.is_admin
        });
    } catch (err) {
        console.error("Update profile error:", err.message);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ msg: messages.join(', ') });
        }
        res.status(500).send('Server error updating profile');
    }
});


module.exports = router;