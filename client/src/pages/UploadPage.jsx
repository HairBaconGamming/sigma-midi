import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadMidiFile } from '../services/apiMidis';
// import '../assets/css/UploadPage.css'; // Tạo file CSS này

const UploadPage = () => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [arrangementBy, setArrangementBy] = useState('');
  const [bpm, setBpm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a MIDI file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    const formData = new FormData();
    formData.append('midiFile', file);
    formData.append('title', title);
    formData.append('artist', artist);
    formData.append('description', description);
    formData.append('arrangementBy', arrangementBy);
    formData.append('bpm', bpm);

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await uploadMidiFile(formData);
      setSuccess(res.data.msg || 'MIDI uploaded successfully!');
      // Tùy chọn: reset form hoặc chuyển hướng
      // setTitle(''); setArtist(''); setDescription(''); setArrangementBy(''); setBpm(''); setFile(null);
      // e.target.reset(); // Reset form fields
      // navigate(`/midi/${res.data.midi.id}`); // Chuyển hướng đến trang chi tiết MIDI vừa upload
      setTimeout(() => {
        if (res.data.midi && res.data.midi.id) {
            navigate(`/midi/${res.data.midi.id}`);
        } else {
            navigate('/');
        }
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.msg || 'Upload failed. Please try again.');
      console.error("Upload error:", err);
    }
    setLoading(false);
  };

  return (
    <div className="upload-page-container">
      <h2>Upload MIDI File</h2>
      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}
      <form onSubmit={onSubmit} className="upload-form">
        <div className="form-group">
          <label htmlFor="title">Title *</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="artist">Artist</label>
          <input
            type="text"
            id="artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="arrangementBy">Arrangement By</label>
          <input
            type="text"
            id="arrangementBy"
            value={arrangementBy}
            onChange={(e) => setArrangementBy(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="bpm">BPM (Tempo)</label>
          <input
            type="number"
            id="bpm"
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            min="0"
          />
        </div>
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="3"
          ></textarea>
        </div>
        <div className="form-group">
          <label htmlFor="midiFile">MIDI File (.mid, .midi) *</label>
          <input
            type="file"
            id="midiFile"
            accept=".mid,.midi"
            onChange={onFileChange}
            required
          />
          {file && <p className="file-name-display">Selected: {file.name}</p>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Uploading...' : 'Upload MIDI'}
        </button>
      </form>
    </div>
  );
};

export default UploadPage;