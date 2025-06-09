// client/src/pages/MyMidisPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Thêm useNavigate
import { useAuth } from '../contexts/AuthContext';
import { getAllMidis, deleteMidiById } from '../services/apiMidis'; // Thêm deleteMidiById
import MidiCard from '../components/midis/MidiCard';
import '../assets/css/MyMidisPage.css';
import { FaMusic, FaPlusCircle, FaEdit, FaTrash } from 'react-icons/fa'; // Thêm FaEdit, FaTrash

const MyMidisPage = () => {
  const { user, loading: authLoading, token } = useAuth();
  const [myMidis, setMyMidis] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageMessage, setPageMessage] = useState({ type: '', content: '' }); // Để hiển thị thông báo thành công/lỗi
  const navigate = useNavigate();

  const fetchMyMidis = useCallback(async () => {
    if (user && token) {
      setIsLoading(true);
      setPageMessage({ type: '', content: '' }); // Xóa thông báo cũ
      try {
        const params = {
          uploaderId: user.id,
          sortBy: 'upload_date',
          order: 'desc',
        };
        const res = await getAllMidis(params);
        setMyMidis(res.data.midis || res.data || []);
        setError('');
      } catch (err) {
        console.error("Failed to fetch user's MIDIs", err);
        setError("Could not load your MIDIs. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    } else if (!authLoading && !user) {
      setError("You need to be logged in to view your MIDIs.");
      setIsLoading(false);
    }
  }, [user, authLoading, token]);

  useEffect(() => {
    if (!authLoading) {
      fetchMyMidis();
    }
  }, [fetchMyMidis, authLoading]);

  const handleDeleteMidi = async (midiId, midiTitle) => {
    if (window.confirm(`Are you sure you want to delete the MIDI: "${midiTitle}"? This action cannot be undone.`)) {
      try {
        await deleteMidiById(midiId);
        setMyMidis(prevMidis => prevMidis.filter(midi => midi._id !== midiId));
        setPageMessage({ type: 'success', content: `MIDI "${midiTitle}" deleted successfully.` });
      } catch (err) {
        console.error("Failed to delete MIDI", err);
        setPageMessage({ type: 'error', content: `Could not delete MIDI: ${err.response?.data?.msg || err.message}` });
      }
    }
  };

  if (authLoading || (isLoading && !myMidis.length)) { // Chỉ hiển thị loading ban đầu
    return (
      <div className="loading-container-page">
        <div className="spinner-page"></div>
        <p>Loading Your MIDIs...</p>
      </div>
    );
  }

  if (error && !myMidis.length) { // Chỉ hiển thị lỗi nếu không có MIDI nào được tải
    return <p className="error-message-page container">{error}</p>;
  }

  return (
    <div className="my-midis-page-container container">
      <header className="my-midis-header">
        <div className="header-title-group"> {/* Thêm group này để icon và title gần nhau hơn */}
          <FaMusic className="header-icon" />
          <h1>My Uploaded MIDIs</h1>
        </div>
        <Link to="/upload" className="btn btn-primary btn-upload-new">
          <FaPlusCircle /> Upload New MIDI
        </Link>
      </header>

      {pageMessage.content && (
        <p className={`alert-message ${pageMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {pageMessage.content}
        </p>
      )}
      {/* Hiển thị lỗi fetch nếu có, ngay cả khi có một số MIDI đã được tải trước đó (ít xảy ra) */}
      {error && myMidis.length > 0 && <p className="alert-message alert-error container">{error}</p>}


      {isLoading && myMidis.length > 0 && ( // Hiển thị loading nhỏ nếu đang fetch lại
        <div className="loading-container-inline"> {/* Tạo style cho cái này */}
            <div className="spinner-inline"></div> Loading updates...
        </div>
      )}

      {!isLoading && myMidis.length === 0 && !error && ( // Chỉ hiển thị khi không loading, không lỗi và không có MIDI
        <div className="no-midis-message">
          <p>You haven't uploaded any MIDIs yet.</p>
          <Link to="/upload" className="btn btn-secondary">Upload Your First MIDI</Link>
        </div>
      )}

      {myMidis.length > 0 && (
        <div className="midi-grid my-midis-grid">
          {myMidis.map((midi) => (
            <div key={midi._id} className="my-midi-card-wrapper"> {/* Sử dụng midi._id */}
              <MidiCard midi={midi} />
              {/* Actions specific to MyMidisPage */}
              <div className="my-midi-actions">
                <Link to={`/midi/edit/${midi._id}`} className="btn btn-icon-action btn-edit-midi" title="Edit MIDI">
                  <FaEdit />
                </Link>
                <button
                  onClick={() => handleDeleteMidi(midi._id, midi.title)}
                  className="btn btn-icon-action btn-delete-midi"
                  title="Delete MIDI"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyMidisPage;