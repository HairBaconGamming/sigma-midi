// client/src/pages/EditMidiPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMidiById, updateMidiDetails } from '../services/apiMidis';
import { useAuth } from '../contexts/AuthContext';
import {
  FaSave, FaMusic, FaUser, FaInfoCircle, FaTachometerAlt,
  FaTags, FaGuitar, FaStopwatch, FaStarHalfAlt, FaClipboardList,
  FaGlobe, FaSignature, FaClock, FaImage, FaUserEdit, FaTimesCircle, FaArrowLeft
} from 'react-icons/fa';
import '../assets/css/UploadPage.css'; // Tái sử dụng CSS từ UploadPage

const EditMidiPage = () => {
  const { id: midiId } = useParams();
  const navigate = useNavigate();
  const { user: authUser, token } = useAuth();

  const initialFormState = {
    title: '',
    artist: '',
    description: '',
    genre: '',
    tags: '', // Sẽ là chuỗi, cần chuyển đổi khi submit
    duration_seconds: '',
    key_signature: '',
    time_signature: '',
    difficulty: '',
    instrumentation: '',
    arrangement_by: '',
    bpm: '',
    is_public: true,
    thumbnail_url: '',
    original_filename: '', // Chỉ để hiển thị, không cho sửa file
  };

  const [formData, setFormData] = useState(initialFormState);
  const [originalMidiData, setOriginalMidiData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false); // Loading cho submit form
  const [pageLoading, setPageLoading] = useState(true); // Loading cho fetch dữ liệu ban đầu

  useEffect(() => {
    const fetchMidiData = async () => {
      if (!midiId || !token) { // Cần token để API có thể kiểm tra quyền (nếu MIDI private)
        setError("Invalid request or not authenticated.");
        setPageLoading(false);
        return;
      }
      setPageLoading(true);
      try {
        const res = await getMidiById(midiId);
        const midiData = res.data;

        // Kiểm tra quyền sở hữu trước khi cho phép chỉnh sửa
        if (!authUser || authUser._id !== midiData.uploader?._id) {
          setError("You are not authorized to edit this MIDI.");
          setPageLoading(false);
          // navigate('/'); // Hoặc trang lỗi
          return;
        }

        setOriginalMidiData(midiData); // Lưu dữ liệu gốc
        setFormData({
          title: midiData.title || '',
          artist: midiData.artist || '',
          description: midiData.description || '',
          genre: midiData.genre || '',
          tags: Array.isArray(midiData.tags) ? midiData.tags.join(', ') : '',
          duration_seconds: midiData.duration_seconds?.toString() || '',
          key_signature: midiData.key_signature || '',
          time_signature: midiData.time_signature || '',
          difficulty: midiData.difficulty?.toString() || '',
          instrumentation: midiData.instrumentation || '',
          arrangement_by: midiData.arrangement_by || '',
          bpm: midiData.bpm?.toString() || '',
          is_public: midiData.is_public !== undefined ? midiData.is_public : true,
          thumbnail_url: midiData.thumbnail_url || '',
          original_filename: midiData.original_filename || 'N/A',
        });
        setError('');
      } catch (err) {
        console.error("Failed to fetch MIDI data for editing:", err);
        setError(err.response?.data?.msg || "Could not load MIDI data for editing.");
      } finally {
        setPageLoading(false);
      }
    };

    fetchMidiData();
  }, [midiId, authUser, token, navigate]); // Thêm navigate vào dependencies

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title is required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    // Chỉ gửi các trường có thể thay đổi
    const updatePayload = {
      title: formData.title.trim(),
      artist: formData.artist.trim(),
      description: formData.description.trim(),
      genre: formData.genre.trim(),
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean), // Chuyển lại thành mảng
      duration_seconds: formData.duration_seconds ? parseInt(formData.duration_seconds, 10) : null,
      key_signature: formData.key_signature.trim(),
      time_signature: formData.time_signature.trim(),
      difficulty: formData.difficulty ? parseInt(formData.difficulty, 10) : null,
      instrumentation: formData.instrumentation.trim(),
      arrangement_by: formData.arrangement_by.trim(),
      bpm: formData.bpm ? parseInt(formData.bpm, 10) : null,
      is_public: formData.is_public,
      thumbnail_url: formData.thumbnail_url.trim(),
    };

    try {
      const res = await updateMidiDetails(midiId, updatePayload);
      setSuccess(res.data.msg || 'MIDI updated successfully!');
      setOriginalMidiData(res.data); // Cập nhật dữ liệu gốc sau khi thành công
      // Cập nhật lại form data với dữ liệu mới nhất từ server (đã được populate)
      setFormData({
        title: res.data.title || '',
        artist: res.data.artist || '',
        description: res.data.description || '',
        genre: res.data.genre || '',
        tags: Array.isArray(res.data.tags) ? res.data.tags.join(', ') : '',
        duration_seconds: res.data.duration_seconds?.toString() || '',
        key_signature: res.data.key_signature || '',
        time_signature: res.data.time_signature || '',
        difficulty: res.data.difficulty?.toString() || '',
        instrumentation: res.data.instrumentation || '',
        arrangement_by: res.data.arrangement_by || '',
        bpm: res.data.bpm?.toString() || '',
        is_public: res.data.is_public !== undefined ? res.data.is_public : true,
        thumbnail_url: res.data.thumbnail_url || '',
        original_filename: res.data.original_filename || 'N/A',
      });
      setTimeout(() => {
        navigate(`/midi/${midiId}`); // Chuyển về trang chi tiết sau khi cập nhật
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.msg || err.message || 'Update failed. Please try again.');
      console.error("Update error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="loading-container-page">
        <div className="spinner-page"></div>
        <p>Loading MIDI Data for Editing...</p>
      </div>
    );
  }

  if (error && !originalMidiData) { // Nếu có lỗi nghiêm trọng và không load được data
    return (
        <div className="upload-page-container-wrapper">
            <div className="upload-page-container" style={{textAlign: 'center'}}>
                 <button onClick={() => navigate(-1)} className="back-button" style={{marginBottom: 'var(--spacing-lg)'}}>
                    <FaArrowLeft /> Back
                </button>
                <p className="message-upload error-upload">{error}</p>
            </div>
        </div>
    );
  }


  return (
    <div className="upload-page-container-wrapper">
      <div className="upload-page-container">
        <button onClick={() => navigate(`/midi/${midiId}`)} className="back-button" style={{marginBottom: 'var(--spacing-lg)'}}>
            <FaArrowLeft /> Back to MIDI Details
        </button>
        <header className="upload-header">
          {/* Có thể dùng icon khác cho edit, ví dụ FaEdit */}
          <FaEdit className="upload-header-icon" style={{color: 'var(--color-warning)'}}/>
          <h2>Edit MIDI Information</h2>
          <p>Update the details for: <strong>{formData.original_filename || originalMidiData?.title}</strong></p>
        </header>

        {error && <p className="message-upload error-upload">{error}</p>}
        {success && <p className="message-upload success-upload"><FaSave style={{marginRight: '5px'}}/> {success}</p>}

        <form onSubmit={onSubmit} className="upload-form-content">
          {/* Phần File Upload sẽ không có ở đây, chỉ hiển thị tên file */}
          <div className="form-section">
            <h4><FaMusic className="icon"/> MIDI File (Not changeable)</h4>
            <div className="file-preview" style={{marginTop: 0}}>
              <FaMusic className="file-icon-preview" />
              <span title={formData.original_filename}>{formData.original_filename}</span>
              {/* Không có nút remove file */}
            </div>
          </div>

          <div className="form-section metadata-section">
            <h4><FaClipboardList className="icon"/> MIDI Information</h4>
            <div className="form-grid">
              <div className="form-group-upload">
                <label htmlFor="title"><FaInfoCircle className="label-icon" /> Title *</label>
                <input type="text" id="title" name="title" value={formData.title} onChange={handleChange} required placeholder="e.g., Moonlight Sonata Mov. 1"/>
              </div>
              <div className="form-group-upload">
                <label htmlFor="artist"><FaUser className="label-icon" /> Artist</label>
                <input type="text" id="artist" name="artist" value={formData.artist} onChange={handleChange} placeholder="e.g., Ludwig Van Beethoven"/>
              </div>
              <div className="form-group-upload">
                <label htmlFor="genre"><FaTags className="label-icon" /> Genre</label>
                <input type="text" id="genre" name="genre" value={formData.genre} onChange={handleChange} placeholder="e.g., Classical, Jazz, Pop" />
              </div>
              <div className="form-group-upload">
                <label htmlFor="bpm"><FaTachometerAlt className="label-icon" /> BPM (Tempo)</label>
                <input type="number" id="bpm" name="bpm" value={formData.bpm} onChange={handleChange} min="0" placeholder="e.g., 120"/>
              </div>
              <div className="form-group-upload">
                <label htmlFor="key_signature"><FaSignature className="label-icon" /> Key Signature</label>
                <input type="text" id="key_signature" name="key_signature" value={formData.key_signature} onChange={handleChange} placeholder="e.g., C Major, A minor"/>
              </div>
              <div className="form-group-upload">
                <label htmlFor="time_signature"><FaClock className="label-icon" /> Time Signature</label>
                <input type="text" id="time_signature" name="time_signature" value={formData.time_signature} onChange={handleChange} placeholder="e.g., 4/4, 3/4"/>
              </div>
               <div className="form-group-upload">
                <label htmlFor="duration_seconds"><FaStopwatch className="label-icon" /> Duration (seconds)</label>
                <input type="number" id="duration_seconds" name="duration_seconds" value={formData.duration_seconds} onChange={handleChange} min="0" placeholder="e.g., 180 (for 3 minutes)"/>
              </div>
              <div className="form-group-upload">
                <label htmlFor="difficulty"><FaStarHalfAlt className="label-icon" /> Difficulty (1-5)</label>
                <input type="number" id="difficulty" name="difficulty" value={formData.difficulty} onChange={handleChange} min="1" max="5" placeholder="1 (Easy) - 5 (Pro)"/>
              </div>
              <div className="form-group-upload full-width-group">
                <label htmlFor="instrumentation"><FaGuitar className="label-icon" /> Instrumentation</label>
                <input type="text" id="instrumentation" name="instrumentation" value={formData.instrumentation} onChange={handleChange} placeholder="e.g., Piano Solo, Orchestra, Jazz Trio, Synthesizer"/>
              </div>
              <div className="form-group-upload full-width-group">
                <label htmlFor="arrangementBy"><FaUserEdit className="label-icon" /> Arrangement By (if applicable)</label>
                <input type="text" id="arrangementBy" name="arrangement_by" value={formData.arrangement_by} onChange={handleChange} />
              </div>
              <div className="form-group-upload full-width-group">
                <label htmlFor="tags"><FaTags className="label-icon" /> Tags (comma-separated)</label>
                <input type="text" id="tags" name="tags" value={formData.tags} onChange={handleChange} placeholder="e.g., epic, cinematic, lofi, tutorial, cover" />
              </div>
              <div className="form-group-upload full-width-group">
                <label htmlFor="thumbnail_url"><FaImage className="label-icon"/> Thumbnail URL (optional)</label>
                <input type="url" id="thumbnail_url" name="thumbnail_url" value={formData.thumbnail_url} onChange={handleChange} placeholder="https://example.com/image.png"/>
              </div>
            </div>
            <div className="form-group-upload full-width-group checkbox-group">
                <input
                    type="checkbox"
                    id="is_public"
                    name="is_public"
                    checked={formData.is_public}
                    onChange={handleChange}
                    className="custom-checkbox"
                />
                <label htmlFor="is_public" className="checkbox-label-text">
                    <FaGlobe className="label-icon"/> Make this MIDI public (visible to everyone)
                </label>
            </div>
            <div className="form-group-upload full-width-group">
              <label htmlFor="description"><FaInfoCircle className="label-icon" /> Description</label>
              <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows="5" placeholder="Add any notes, credits, software used, or details about this MIDI file..."></textarea>
            </div>
          </div>

          <button type="submit" className="btn-upload-submit" disabled={loading || pageLoading} style={{backgroundColor: loading || pageLoading ? 'var(--color-text-disabled)' : 'var(--color-warning)'}}>
            {loading ? ( <><span className="spinner-btn-upload"></span> Saving Changes...</> )
             : ( <><FaSave /> Save Changes</> )
            }
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditMidiPage;