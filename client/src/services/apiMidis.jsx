// client/src/services/apiMidis.jsx
import api from './api';

// params can include { sortBy, order, search, page, limit, uploaderId, genre, difficulty }
export const getAllMidis = (params) => api.get('/midis', { params });

export const getMidiById = (id) => api.get(`/midis/${id}`);

export const uploadMidiFile = (formData, onUploadProgress) => {
  return api.post('/midis/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress
  });
};

export const trackMidiDownload = (id) => api.get(`/midis/download-track/${id}`);

export const getMidiFileStreamUrl = (fileId) => {
  return `${api.defaults.baseURL || ''}/files/stream/${fileId}`;
};

export const updateMidiDetails = (id, midiData) => api.put(`/midis/${id}`, midiData);
export const deleteMidiById = (id) => api.delete(`/midis/${id}`);

export const getMyMidis = (uploaderId, params) => {
    return getAllMidis({ ...params, uploaderId });
};

// --- CORRECTED FUNCTION ---
export const getRandomMidi = async (excludeId = null) => {
  try {
    // For true efficiency, a backend endpoint `/api/midis/random?exclude=...` is best.
    // This client-side approach is a good fallback.
    const params = { limit: 10, sortBy: 'upload_date', order: 'desc' };
    const res = await api.get('/midis', { params });
    
    if (res.data && res.data.midis && res.data.midis.length > 0) {
      let candidates = res.data.midis;
      if (excludeId) {
        candidates = candidates.filter(m => m._id !== excludeId);
      }
      if (candidates.length > 0) {
        const randomIndex = Math.floor(Math.random() * candidates.length);
        // **FIX:** Return the MIDI object directly, not wrapped in a `data` property.
        return candidates[randomIndex];
      }
    }
    return null; // No suitable MIDI found
  } catch (error) {
    console.error("Error fetching random MIDI in apiMidis.jsx:", error);
    throw error; // Re-throw to be caught by the calling function in PlayerContext
  }
};