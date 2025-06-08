// client/src/services/apiMidis.js
import api from './api';

// params can include { sortBy, order, search, page, limit, uploaderId, genre, difficulty }
export const getAllMidis = (params) => api.get('/midis', { params });

export const getMidiById = (id) => api.get(`/midis/${id}`);

export const uploadMidiFile = (formData, onUploadProgress) => {
  return api.post('/midis/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress // Pass a callback for progress tracking
  });
};

// Tracks the download and returns info. Actual download is via /api/files/stream/:fileId
export const trackMidiDownload = (id) => api.get(`/midis/download-track/${id}`);

// NEW: Function to get the direct stream URL for a MIDI file
// fileId is the _id of the file in GridFS (stored as midi.fileId in Midi model)
export const getMidiFileStreamUrl = (fileId) => {
  // Assuming your api instance is configured with the correct baseURL for the backend
  // If api.defaults.baseURL is '/api', this will construct a relative URL.
  // If your backend is on a different domain, ensure baseURL is set correctly or use absolute URL.
  return `${api.defaults.baseURL || ''}/files/stream/${fileId}`;
};


// If you implement delete/update functionality for users on their own MIDIs
export const updateMidiDetails = (id, midiData) => api.put(`/midis/${id}`, midiData);
export const deleteMidiById = (id) => api.delete(`/midis/${id}`);

// Placeholder for fetching user's MIDIs (can use getAllMidis with uploaderId param)
export const getMyMidis = (uploaderId, params) => {
    return getAllMidis({ ...params, uploaderId });
};

// Placeholder for fetching user profile (public view)
export const getUserPublicProfile = (userId) => api.get(`/auth/profile/${userId}`);