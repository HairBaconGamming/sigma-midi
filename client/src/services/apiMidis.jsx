import api from './api';

export const getAllMidis = (params) => api.get('/midis', { params }); // params for sort, search

export const getMidiById = (id) => api.get(`/midis/${id}`);

export const uploadMidiFile = (formData) => {
  return api.post('/midis/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const trackMidiDownload = (id) => api.get(`/midis/download/${id}`);