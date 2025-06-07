// client/src/services/apiMidis.js
import api from './api';

// params can include { sortBy, order, search, page, limit }
export const getAllMidis = (params) => api.get('/midis', { params });

export const getMidiById = (id) => api.get(`/midis/${id}`);

export const uploadMidiFile = (formData) => {
  // Token should be automatically included by the api instance if set in AuthContext
  return api.post('/midis/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// This endpoint on the backend increments the download count
// The actual file download is handled by a direct link to the static file
export const trackMidiDownload = (id) => api.get(`/midis/download/${id}`);

// If you implement delete functionality
// export const deleteMidiById = (id) => api.delete(`/midis/${id}`);