// client/src/services/apiMidis.js
import api from './api';

// params can include { sortBy, order, search, page, limit, genre, difficulty, uploaderId }
export const getAllMidis = (params) => api.get('/midis', { params });

export const getMidiById = (id) => api.get(`/midis/${id}`);

export const uploadMidiFile = (formData) => {
  // Token should be automatically included by the api instance if set in AuthContext
  return api.post('/midis/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    // Optional: for upload progress
    // onUploadProgress: progressEvent => {
    //   const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
    //   console.log(percentCompleted);
    //   // You can dispatch an action or call a callback here to update UI
    // }
  });
};

// This endpoint on the backend increments the download count
export const trackMidiDownload = (id) => api.get(`/midis/download-track/${id}`);

// NEW: Function to get the actual streamable/downloadable URL for a MIDI file
// The `fileId` comes from the `midi.fileId` property of a MIDI object fetched from `/api/midis`
export const getMidiFileUrl = (fileId) => {
  if (!fileId) return null;
  // Assuming your Express app serves static files from '/api' prefix for API routes
  // and the file streaming route is '/api/files/stream/:fileId'
  return `/api/files/stream/${fileId}`; // This URL will be used in <audio> or download links
};


// If you implement delete functionality
// export const deleteMidiById = (id) => api.delete(`/midis/${id}`);