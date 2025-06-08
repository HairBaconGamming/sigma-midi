const mongoose = require('mongoose');

const MidiSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [150, 'Title cannot be more than 150 characters'],
  },
  artist: {
    type: String,
    trim: true,
    maxlength: [100, 'Artist name cannot be more than 100 characters'],
    default: 'Unknown Artist',
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters'],
  },
  genre: { type: String, trim: true, index: true },
  tags: [{ type: String, trim: true, lowercase: true }], // Mảng các tag
  duration_seconds: { type: Number, min: 0 },
  key_signature: { type: String, trim: true },
  time_signature: { type: String, trim: true },
  difficulty: { type: Number, min: 1, max: 5 }, // Ví dụ thang điểm 1-5
  instrumentation: { type: String, trim: true },
  arrangement_by: { type: String, trim: true },
  bpm: { type: Number, min: 0 },
  uploader: { // Thay vì uploader_id và uploader_username riêng
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Thông tin file từ GridFS
  fileId: { // ID của file trong GridFS
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  filenameGridFs: { // Tên file được lưu trong GridFS (tên ngẫu nhiên)
    type: String,
    required: true,
  },
  original_filename: { type: String }, // Tên file gốc khi upload
  contentType: { type: String, default: 'audio/midi' }, // MIME type
  size_bytes: { type: Number, default: 0 }, // Kích thước file bằng bytes

  upload_date: { type: Date, default: Date.now, index: true },
  last_updated_date: { type: Date, default: Date.now },
  views: { type: Number, default: 0, index: true },
  downloads: { type: Number, default: 0, index: true },
  rating_avg: { type: Number, default: 0, min: 0, max: 5 },
  rating_count: { type: Number, default: 0 },
  is_public: { type: Boolean, default: true, index: true },
  is_featured: { type: Boolean, default: false, index: true },
  thumbnail_url: { type: String }, // URL đến thumbnail (có thể là file tĩnh hoặc từ dịch vụ khác)
}, {
  timestamps: { createdAt: 'upload_date', updatedAt: 'last_updated_date' }
});

// Text index cho tìm kiếm (MongoDB Atlas Free Tier có thể không hỗ trợ $text search hiệu quả)
// Cân nhắc dùng regex hoặc Atlas Search nếu cần tìm kiếm nâng cao.
MidiSchema.index({ title: 'text', artist: 'text', tags: 'text', description: 'text', uploader_username_denormalized: 'text' }); // uploader_username_denormalized cần được thêm nếu muốn search theo tên uploader
MidiSchema.index({ genre: 1 });
MidiSchema.index({ uploader: 1 });


// Middleware để cập nhật last_updated_date
MidiSchema.pre('save', function(next) {
  if (this.isModified()) { // Chỉ cập nhật nếu có thay đổi
    this.last_updated_date = Date.now();
  }
  next();
});
MidiSchema.pre('findOneAndUpdate', function(next) {
    this.set({ last_updated_date: Date.now() });
    next();
});


module.exports = mongoose.model('Midi', MidiSchema);