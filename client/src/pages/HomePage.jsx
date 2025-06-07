// client/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { getAllMidis } from '../services/apiMidis';
import MidiCard from '../components/midis/MidiCard';
import { FaSearch, FaSortAmountDown, FaSortAmountUp, FaFolderOpen } from 'react-icons/fa';
import '../assets/css/HomePage.css';

// Debounce function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(null, args);
    }, delay);
  };
};

const HomePage = () => {
  const [midis, setMidis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('upload_date');
  const [order, setOrder] = useState('desc');
  const [totalFiles, setTotalFiles] = useState(0);
  // const [currentPage, setCurrentPage] = useState(1);
  // const [totalPages, setTotalPages] = useState(1);
  // const filesPerPage = 12; // Or get from config

  const fetchMidis = useCallback(async (currentSearchTerm, currentSortBy, currentOrder) => {
    try {
      setLoading(true);
      const params = {
        search: currentSearchTerm,
        sortBy: currentSortBy,
        order: currentOrder,
        // page: currentPage,
        // limit: filesPerPage
      };
      const res = await getAllMidis(params);
      // Assuming API returns array directly, or an object like { midis: [], total: X } for pagination
      if (Array.isArray(res.data)) {
        setMidis(res.data);
        setTotalFiles(res.data.length); // Simple count if no pagination from API
      } else if (res.data && Array.isArray(res.data.midis)) {
        setMidis(res.data.midis);
        setTotalFiles(res.data.total);
        // setTotalPages(Math.ceil(res.data.total / filesPerPage));
      } else {
        setMidis([]);
        setTotalFiles(0);
      }
      setError('');
    } catch (err) {
      console.error("Failed to fetch MIDIs", err.response ? err.response.data : err.message);
      setError('Failed to load MIDIs. The server might be down or an error occurred.');
      setMidis([]);
      setTotalFiles(0);
    } finally {
      setLoading(false);
    }
  }, []); // Add currentPage, filesPerPage if using pagination

  const debouncedFetchMidis = useCallback(debounce(fetchMidis, 500), [fetchMidis]);

  useEffect(() => {
    // Initial fetch or when sort/order changes directly
    if (searchTerm === '') { // Avoid double fetch on initial load if searchTerm is also a dep
        fetchMidis(searchTerm, sortBy, order);
    }
  }, [sortBy, order, fetchMidis]); // Removed searchTerm to rely on debounced version

  useEffect(() => {
    // Debounced fetch for search term changes
    debouncedFetchMidis(searchTerm, sortBy, order);
  }, [searchTerm, debouncedFetchMidis, sortBy, order]);


  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    // setCurrentPage(1); // Reset to first page on new search
  };

  const handleSortByChange = (e) => {
    setSortBy(e.target.value);
    // setCurrentPage(1);
  };

  const handleOrderChange = (e) => {
    setOrder(e.target.value);
    // setCurrentPage(1);
  };

  return (
    <div className="homepage-container">
      <header className="repository-header-container">
        <FaFolderOpen className="repository-icon" />
        <h1 className="repository-title">
          sigmaMIDI Repository
          <span className="repository-count">({loading ? '...' : totalFiles} MIDI files)</span>
        </h1>
      </header>

      <div className="controls-bar-container">
        <div className="search-control">
          <FaSearch className="search-icon-input" />
          <input
            type="text"
            placeholder="Search by Title, Artist, Uploader..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input-field"
          />
        </div>
        <div className="sort-controls">
          <div className="select-wrapper">
            <select value={sortBy} onChange={handleSortByChange} className="sort-select-field">
              <option value="upload_date">Newest</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="views">Most Viewed</option>
              <option value="downloads">Most Downloaded</option>
              <option value="bpm">BPM</option>
              <option value="size_kb">File Size</option>
            </select>
          </div>
          <div className="select-wrapper">
            <select value={order} onChange={handleOrderChange} className="sort-select-field">
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
            {order === 'desc' ? <FaSortAmountDown className="sort-icon-indicator" /> : <FaSortAmountUp className="sort-icon-indicator" />}
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading MIDIs...</p>
        </div>
      )}
      {error && <p className="error-message-global">{error}</p>}
      {!loading && !error && midis.length === 0 && (
        <p className="no-results-message">
          No MIDIs found matching your criteria. Try adjusting your search or upload a new one!
        </p>
      )}

      {!loading && !error && midis.length > 0 && (
        <div className="midi-grid">
          {midis.map((midi) => (
            <MidiCard key={midi.id} midi={midi} />
          ))}
        </div>
      )}

      {/* Placeholder for Pagination Controls */}
      {/* {!loading && !error && totalPages > 1 && (
        <div className="pagination-controls">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            Next
          </button>
        </div>
      )} */}
    </div>
  );
};

export default HomePage;