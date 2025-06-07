// client/src/pages/UploadPage.jsx
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadMidiFile } from '../services/apiMidis';
import { FaFileUpload, FaMusic, FaUser, FaInfoCircle, FaTachometerAlt, FaTimesCircle } from 'react-icons/fa';
import { useDropzone } from 'react-dropzone';
import '../assets/css/UploadPage.css';

const UploadPage = () => {
  const [file, setFile] = useState(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [arrangementBy, setArrangementBy] = useState('');
  const [bpm, setBpm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigate = useNavigate();

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      if (selectedFile.type === "audio/midi" || selectedFile.type === "audio/mid" || selectedFile.name.endsWith('.mid') || selectedFile.name.endsWith('.midi')) {
        setFile(selectedFile);
        setPreviewFileName(selectedFile.name);
        setError('');
      } else {
        setError('Invalid file type. Please upload a .mid or .midi file.');
        setFile(null);
        setPreviewFileName('');
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {'audio/midi': ['.mid', '.midi']},
    multiple: false
  });

  const removeFile = () => {
    setFile(null);
    setPreviewFileName('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select or drop a MIDI file to upload.');
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
    setUploadProgress(0);

    try {
      const res = await uploadMidiFile(formData, {
        onUploadProgress: progressEvent => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      setSuccess(res.data.msg || 'MIDI uploaded successfully!');
      setTimeout(() => {
        if (res.data.midi && res.data.midi.id) {
            navigate(`/midi/${res.data.midi.id}`);
        } else {
            navigate('/');
        }
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.msg || 'Upload failed. Please try again.');
      console.error("Upload error:", err.response ? err.response.data : err.message);
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-page-container-wrapper">
      <div className="upload-page-container">
        <header className="upload-header">
          <FaFileUpload className="upload-header-icon" />
          <h2>Share Your MIDI Masterpiece</h2>
          <p>Upload your .mid or .midi files and contribute to the sigmaMIDI community.</p>
        </header>

        {error && <p className="message-upload error-upload">{error}</p>}
        {success && <p className="message-upload success-upload">{success}</p>}

        <form onSubmit={onSubmit} className="upload-form-content">
          <div className="form-section dropzone-section">
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              <FaFileUpload className="dropzone-icon" />
              {isDragActive ? (
                <p>Drop the MIDI file here ...</p>
              ) : (
                <p>Drag 'n' drop a MIDI file here, or click to select file</p>
              )}
              <p className="dropzone-hint">(.mid, .midi files only, max 10MB)</p>
            </div>
            {previewFileName && (
              <div className="file-preview">
                <FaMusic className="file-icon-preview" />
                <span>{previewFileName}</span>
                <button type="button" onClick={removeFile} className="remove-file-btn" title="Remove file">
                  <FaTimesCircle />
                </button>
              </div>
            )}
          </div>

          <div className="form-section metadata-section">
            <h4>MIDI Information</h4>
            <div className="form-grid">
              <div className="form-group-upload">
                <label htmlFor="title"><FaInfoCircle className="label-icon" /> Title *</label>
                <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="form-group-upload">
                <label htmlFor="artist"><FaUser className="label-icon" /> Artist</label>
                <input type="text" id="artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
              </div>
              <div className="form-group-upload">
                <label htmlFor="arrangementBy"><FaUserEdit className="label-icon" /> Arrangement By</label>
                <input type="text" id="arrangementBy" value={arrangementBy} onChange={(e) => setArrangementBy(e.target.value)} />
              </div>
              <div className="form-group-upload">
                <label htmlFor="bpm"><FaTachometerAlt className="label-icon" /> BPM (Tempo)</label>
                <input type="number" id="bpm" value={bpm} onChange={(e) => setBpm(e.target.value)} min="0" />
              </div>
            </div>
            <div className="form-group-upload full-width-group">
              <label htmlFor="description"><FaInfoCircle className="label-icon" /> Description</label>
              <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows="4"></textarea>
            </div>
          </div>

          {loading && (
            <div className="upload-progress-container">
              <div className="progress-bar-upload" style={{ width: `${uploadProgress}%` }}>
                {uploadProgress > 0 && `${uploadProgress}%`}
              </div>
            </div>
          )}

          <button type="submit" className="btn-upload-submit" disabled={loading || !file}>
            {loading ? (
              <>
                <span className="spinner-btn-upload"></span> Uploading...
              </>
            ) : (
              <><FaUpload /> Upload MIDI</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadPage;