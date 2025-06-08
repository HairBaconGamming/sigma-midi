const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please add a username'],
    unique: true,
    trim: true,
    lowercase: true, // Để đảm bảo unique không phân biệt hoa thường ở tầng ứng dụng
  },
  email: { // Tùy chọn
    type: String,
    // required: [true, 'Please add an email'],
    unique: true,
    sparse: true, // Cho phép nhiều document có email là null/undefined
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false, // Không tự động trả về password khi query user
  },
  registration_date: {
    type: Date,
    default: Date.now,
  },
  last_login_date: {
    type: Date,
  },
  is_admin: {
    type: Boolean,
    default: false,
  },
  profile_picture_url: {
    type: String,
    default: '', // Hoặc một URL placeholder
  },
  bio: {
    type: String,
    maxlength: 500,
    default: '',
  },
  // favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Midi' }] // Nếu muốn lưu favorites ở user
}, {
  timestamps: { createdAt: 'registration_date', updatedAt: 'last_updated_profile_date' } // Tự động quản lý timestamps
});

// Middleware để hash password trước khi lưu
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) { // Chỉ hash nếu password được thay đổi (hoặc mới)
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method để so sánh password đã nhập với password đã hash trong DB
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);