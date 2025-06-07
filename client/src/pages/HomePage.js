import React, { useState, useEffect } from 'react';
import { getAllMidis } from '../services/apiMidis';
import MidiCard from '../components/midis/MidiCard'; // Tạo component này
import '../assets/css/HomePage.css';

const HomePage = () => {
  const [midis, setMidis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('upload_date'); // 'upload_date', 'title', 'views', 'downloads'
  const [order, setOrder] = useState('desc');


  useEffect(() => {
    const fetchMidis = async () => {
      try {
        setLoading(true);
        const params = { search: searchTerm, sortBy, order };
        const res = await getAllMidis(params);
        setMidis(res.data);
        setError('');
      } catch (err) {
        console.error("Failed to fetch MIDIs", err);
        setError('Failed to load MIDIs. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchMidis();
  }, [searchTerm, sortBy, order]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Thêm hàm debounce cho search nếu muốn
  // const debouncedSearch = useCallback(debounce((term) => fetchMidis(term), 500), []);
  // useEffect(() => { debouncedSearch(searchTerm); }, [searchTerm, debouncedSearch]);


  return (
    <div className="homepage-container">
      <div className="repository-header">
        <span className="folder-icon">📁</span>
        <h2>nanoMIDI's MIDI Repository ({midis.length} MIDI files)</h2>
      </div>

      <div className="controls-bar">
        <input
          type="text"
          placeholder="Search MIDIs..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="search-input"
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
            <option value="upload_date">Newest</option>
            <option value="title">Title</option>
            <option value="views">Views</option>
            <option value="downloads">Downloads</option>
            <option value="artist">Artist</option>
        </select>
         <select value={order} onChange={(e) => setOrder(e.target.value)} className="sort-select">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
        </select>
      </div>


      {loading && <p>Loading MIDIs...</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && !error && midis.length === 0 && <p>No MIDIs found.</p>}

      <div className="midi-list">
        {midis.map((midi) => (
          <MidiCard key={midi.id} midi={midi} />
        ))}
      </div>
    </div>
  );
};

export default HomePage;