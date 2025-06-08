// client/src/pages/UploadPage.jsx
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadMidiFile } from '../services/apiMidis';
import { FaFileUpload, FaMusic, FaUser, FaInfoCircle, FaTachometerAlt, FaTimesCircle, FaTags, FaGuitar, FaStopwatch, FaStarHalfAlt, FaClipboardList, FaCheckCircle, FaGlobe, FaUserEdit } from 'react-icons/fa';
import { useDropzone } from 'react-dropzone';
import '../assets/css/UploadPage.css'; // Ensure this CSS file is created and styled

const UploadPage = () => {
  const [file, setFile] = useState(null);
  const [previewFileName, setPreviewFileName] = useState('');

  // Metadata fields
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [tags, setTags] = useState(''); // Comma-separated string
  const [duration_seconds, setDurationSeconds] = useState('');
  const [key_signature, setKeySignature] = useState('');
  const [time_signature, setTimeSignature] = useState('');
  const [difficulty, setDifficulty] = useState(''); // 1-5
  const [instrumentation, setInstrumentation] = useState('');
  const [arrangementBy, setArrangementBy] = useState('');
  const [bpm, setBpm] = useState('');
  const [is_public, setIsPublic] = useState(true);
  const [thumbnail_url, setThumbnailUrl] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigate = useNavigate();

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      // More robust MIME type check and extension check
      const allowedMimeTypes = ['audio/midi', 'audio/mid', 'application/x-midi'];
      const allowedExtensions = ['.mid', '.midi'];
      const fileExtension = selectedFile.name.slice(selectedFile.name.lastIndexOf('.')).toLowerCase();

      if (allowedMimeTypes.includes(selectedFile.type) || allowedExtensions.includes(fileExtension)) {
        if (selectedFile.size > 15 * 1024 * 1024) { // 15MB limit
            setError('File is too large. Maximum size is 15MB.');
            setFile(null);
            setPreviewFileName('');
            return;
        }
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

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
        'audio/midi': ['.mid', '.midi'],
        'audio/mid': ['.mid', '.midi'], // Some systems might use this
        'application/x-midi': ['.mid', '.midi']
    },
    multiple: false,
    maxSize: 15 * 1024 * 1024, // 15MB
    onDropRejected: (rejectedFiles) => {
        if (rejectedFiles && rejectedFiles.length > 0) {
            const firstError = rejectedFiles[0].errors[0];
            if (firstError.code === 'file-too-large') {
                setError('File is too large. Maximum size is 15MB.');
            } else if (firstError.code === 'file-invalid-type') {
                setError('Invalid file type. Please upload a .mid or .midi file.');
            } else {
                setError('File rejected. Please try another file.');
            }
        }
    }
  });

  const removeFile = () => {
    setFile(null);
    setPreviewFileName('');
    if (document.getElementById('midiFile')) { // Reset file input if it exists
        document.getElementById('midiFile').value = null;
    }
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

    const formDataPayload = new FormData();
    formDataPayload.append('midiFile', file);
    formDataPayload.append('title', title.trim());
    formDataPayload.append('artist', artist.trim());
    formDataPayload.append('description', description.trim());
    formDataPayload.append('genre', genre.trim());
    formDataPayload.append('tags', tags.trim()); // Backend will split by comma
    if (duration_seconds) formDataPayload.append('duration_seconds', parseInt(duration_seconds, 10));
    formDataPayload.append('key_signature', key_signature.trim());
    formDataPayload.append('time_signature', time_signature.trim());
    if (difficulty) formDataPayload.append('difficulty', parseInt(difficulty, 10));
    formDataPayload.append('instrumentation', instrumentation.trim());
    formDataPayload.append('arrangementBy', arrangementBy.trim());
    if (bpm) formDataPayload.append('bpm', parseInt(bpm, 10));
    formDataPayload.append('is_public', is_public);
    formDataPayload.append('thumbnail_url', thumbnail_url.trim());

    setLoading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);

    try {
      const res = await uploadMidiFile(formDataPayload, (progressEvent) => {
        if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
        } else {
            // Indeterminate progress if total is not available
            setUploadProgress(50); // Or some other visual cue
        }
      });
      setSuccess(res.data.msg || 'MIDI uploaded successfully!');
      setUploadProgress(100); // Ensure it hits 100 on success
      setTimeout(() => {
        if (res.data.midi && res.data.midi._id) {
            navigate(`/midi/${res.data.midi._id}`);
        } else {
            navigate('/'); // Fallback
        }
      }, 1200); // Shorter delay

    } catch (err) {
      setError(err.response?.data?.msg || err.message || 'Upload failed. Please try again.');
      console.error("Upload error:", err);
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
        {success && <p className="message-upload success-upload"><FaCheckCircle/> {success}</p>}

        <form onSubmit={onSubmit} className="upload-form-content">
          <div className="form-section dropzone-section">
            <h4><FaMusic className="icon"/> MIDI File</h4>
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''} ${isDragReject ? 'reject' : ''}`}>
              <input {...getInputProps()} id="midiFile" /> {/* Added id for potential reset */}
              <FaFileUpload className="dropzone-icon" />
              {isDragActive && !isDragReject && <p>Drop the MIDI file here ...</p>}
              {!isDragActive && !previewFileName && <p>Drag 'n' drop a MIDI file here, or click to select</p>}
              {isDragReject && <p style={{color: 'var(--color-error)'}}>Invalid file type!</p>}
              <p className="dropzone-hint">(.mid, .midi files only, max 15MB)</p>
            </div>
            {previewFileName && (
              <div className="file-preview">
                <FaMusic className="file-icon-preview" />
                <span title={previewFileName}>{previewFileName}</span>
                <button type="button" onClick={removeFile} className="remove-file-btn" title="Remove file">
                  <FaTimesCircle />
                </button>
              </div>
            )}
          </div>

          <div className="form-section metadata-section">
            <h4><FaClipboardList className="icon"/> MIDI Information</h4>
            <div className="form-grid">
              <div className="form-group-upload">
                <label htmlFor="title"><FaInfoCircle className="label-icon" /> Title *</label>
                <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Moonlight Sonata Mov. 1"/>
              </div>
              <div className="form-group-upload">
                <label htmlFor="artist"><FaUser className="label-icon" /> Artist</label>
                <input type="text" id="artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="e.g., Ludwig Van Beethoven"/>
              </div>
              <div className="form-group-upload">
                <label htmlFor="genre"><FaTags className="label-icon" /> Genre</label>
                <input type="text" id="genre" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="e.g., Classical, Jazz, Pop" />
              </div>
              <div className="form-group-upload">
                <label htmlFor="bpm"><FaTachometerAlt className="label-icon" /> BPM (Tempo)</label>
                <input type="number" id="bpm" value={bpm} onChange={(e) => setBpm(e.target.value)} min="0" placeholder="e.g., 120"/>
              </div>
              <div className="form-group-upload">
                <label htmlFor="key_signature">Key Signature</label>
                <input type="text" id="key_signature" value={key_signature} onChange={(e) => setKeySignature(e.target.value)} placeholder="e.g., C Major, A minor"/>
              </div>
              <div className="form-group-upload">
                <label htmlFor="time_signature">Time Signature</label>
                <input type="text" id="time_signature" value={time_signature} onChange={(e) => setTimeSignature(e.target.value)} placeholder="e.g., 4/4, 3/4"/>
              </div>
               <div className="form-group-upload">
                <label htmlFor="duration_seconds"><FaStopwatch className="label-icon" /> Duration (seconds)</label>
                <input type="number" id="duration_seconds" value={duration_seconds} onChange={(e) => setDurationSeconds(e.target.value)} min="0" placeholder="e.g., 180 (for 3 minutes)"/>
              </div>
              <div className="form-group-upload">
                <label htmlFor="difficulty"><FaStarHalfAlt className="label-icon" /> Difficulty (1-5)</label>
                <input type="number" id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} min="1" max="5" placeholder="1 (Easy) - 5 (Pro)"/>
              </div>
              <div className="form-group-upload full-width-group">
                <label htmlFor="instrumentation"><FaGuitar className="label-icon" /> Instrumentation</label>
                <input type="text" id="instrumentation" value={instrumentation} onChange={(e) => setInstrumentation(e.target.value)} placeholder="e.g., Piano Solo, Orchestra, Jazz Trio, Synthesizer"/>
              </div>
              <div className="form-group-upload full-width-group">
                <label htmlFor="arrangementBy"><FaUserEdit className="label-icon" /> Arrangement By (if applicable)</label>
                <input type="text" id="arrangementBy" value={arrangementBy} onChange={(e) => setArrangementBy(e.target.value)} />
              </div>
              <div className="form-group-upload full-width-group">
                <label htmlFor="tags"><FaTags className="label-icon" /> Tags (comma-separated)</label>
                <input type="text" id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g., epic, cinematic, lofi, tutorial, cover" />
              </div>
              <div className="form-group-upload full-width-group">
                <label htmlFor="thumbnail_url">Thumbnail URL (optional)</label>
                <input type="url" id="thumbnail_url" value={thumbnail_url} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://example.com/image.png"/>
              </div>
            </div>
            <div className="form-group-upload full-width-group checkbox-group">
                <input type="checkbox" id="is_public" name="is_public" checked={is_public} onChange={(e) => setIsPublic(e.target.checked)} className="custom-checkbox"/>
                <label htmlFor="is_public" className="checkbox-label-text">
                    <FaGlobe className="label-icon"/> Make this MIDI public (visible to everyone)
                </label>
            </div>
            <div className="form-group-upload full-width-group">
              <label htmlFor="description"><FaInfoCircle className="label-icon" /> Description</label>
              <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows="5" placeholder="Add any notes, credits, software used, or details about this MIDI file..."></textarea>
            </div>
          </div>

          {loading && (
            <div className="upload-progress-container">
              <div className="progress-bar-upload" style={{ width: `${uploadProgress}%` }} role="progressbar" aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100">
                {uploadProgress > 5 && `${uploadProgress}%`} {/* Show percentage when bar is visible enough */}
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