const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Để gọi Database API

const DATABASE_API_URL = process.env.DATABASE_API_URL;

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', async (req, res) => {
  const { username, password }_ = req.body;

  if (!username || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  try {
    // Gọi Database API để kiểm tra user tồn tại và tạo user
    let userResponse;
    try {
      userResponse = await axios.get(`${DATABASE_API_URL}/users/username/${username}`);
      if (userResponse.data) {
        return res.status(400).json({ msg: 'User already exists' });
      }
    } catch (error) {
      // Lỗi 404 nghĩa là user chưa tồn tại, đó là điều tốt
      if (error.response && error.response.status !== 404) {
        console.error("Error checking user existence:", error.message);
        return res.status(500).send('Server error while checking user');
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUserResponse = await axios.post(`${DATABASE_API_URL}/users`, {
      username,
      password: hashedPassword,
    });

    const user = newUserResponse.data;

    const payload = {
      user: {
        id: user.id, // ID từ database API trả về
        username: user.username
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 360000 }, // Token hết hạn sau 100 giờ
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: { id: user.id, username: user.username }
        });
      }
    );
  } catch (err) {
    console.error("Register error:", err.message);
    if (err.response && err.response.data) console.error("DB API Response:", err.response.data);
    res.status(500).send('Server error during registration');
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
   if (!username || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  try {
    // Gọi Database API để lấy user
    let user;
    try {
        const userResponse = await axios.get(`${DATABASE_API_URL}/users/username/${username}`);
        user = userResponse.data;
         if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials (user not found)' });
        }
    } catch (error) {
         if (error.response && error.response.status === 404) {
            return res.status(400).json({ msg: 'Invalid credentials (user not found)' });
        }
        console.error("Login error - fetching user:", error.message);
        return res.status(500).send('Server error during login');
    }


    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials (password mismatch)' });
    }

    const payload = {
      user: {
        id: user.id,
        username: user.username
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: { id: user.id, username: user.username }
        });
      }
    );
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/auth/user
// @desc    Get user data (nếu đã login)
// @access  Private
const authMiddleware = require('../middleware/authMiddleware');
router.get('/user', authMiddleware, async (req, res) => {
  try {
    // req.user được set bởi authMiddleware
    // Gọi Database API để lấy thông tin user mới nhất (tùy chọn, vì JWT đã có username)
    const userResponse = await axios.get(`${DATABASE_API_URL}/users/${req.user.id}`);
    res.json(userResponse.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


module.exports = router;