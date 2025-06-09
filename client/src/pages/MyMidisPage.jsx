// client/src/pages/MyMidisPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllMidis, deleteMidiById } from '../services/apiMidis';
import MidiCard from '../components/midis/MidiCard';
import PaginationControls from '../components/layout/PaginationControls'; // IMPORT COMPONENT
import '../assets/css/MyMidisPage.css';
import { FaMusic, FaPlusCircle, FaEdit, FaTrash } from 'react-icons/fa';

const ITEMS_PER_PAGE_MY_MIDIS = 8; // Hoặc một giá trị khác phù hợp cho trang này

const MyMidisPage = () => {
  const { user, loading: authLoading, token } = useAuth();
  const [myMidis, setMyMidis] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageMessage, setPageMessage] = useState({ type: '', content: '' });
  const navigate = useNavigate();

  // State cho phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMidiCount, setTotalMidiCount] = useState(0); // Để hiển thị tổng số MIDI của user

  const fetchMyMidis = useCallback(async (pageToFetch) => {
    if (user && token) {
      setIsLoading(true);
      // Không cần xóa pageMessage ở đây nếu muốn nó tồn tại qua các lần fetch (ví dụ sau khi xóa)
      // setPageMessage({ type: '', content: '' });
      try {
        const params = {
          uploaderId: user._id, // Đảm bảo user._id là đúng
          sortBy: 'upload_date',
          order: 'desc',
          page: pageToFetch,
          limit: ITEMS_PER_PAGE_MY_MIDIS,
        };
        const res = await getAllMidis(params);
        if (res.data && Array.isArray(res.data.midis)) {
            setMyMidis(res.data.midis);
            setTotalMidiCount(res.data.totalItems || 0);
            setTotalPages(res.data.totalPages || 1);
            setCurrentPage(res.data.currentPage || 1); // Cập nhật lại currentPage từ API
        } else {
            setMyMidis([]);
            setTotalMidiCount(0);
            setTotalPages(1);
            setCurrentPage(1);
        }
        setError('');
      } catch (err) {
        console.error("Failed to fetch user's MIDIs", err);
        setError("Could not load your MIDIs. Please try again later.");
        // Giữ lại dữ liệu cũ nếu có lỗi khi fetch trang mới, hoặc xóa tùy theo UX bạn muốn
        // setMyMidis([]); 
        // setTotalMidiCount(0);
        // setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    } else if (!authLoading && !user) {
      setError("You need to be logged in to view your MIDIs.");
      setIsLoading(false);
    }
  }, [user, authLoading, token]); // Bỏ ITEMS_PER_PAGE_MY_MIDIS nếu là hằng số

  useEffect(() => {
    if (!authLoading && user) { // Chỉ fetch khi user đã load và tồn tại
      fetchMyMidis(currentPage);
    }
  }, [fetchMyMidis, authLoading, user, currentPage]); // Thêm user và currentPage vào dependencies

  const handleDeleteMidi = async (midiId, midiTitle) => {
    if (window.confirm(`Are you sure you want to delete the MIDI: "${midiTitle}"? This action cannot be undone.`)) {
      try {
        await deleteMidiById(midiId);
        setPageMessage({ type: 'success', content: `MIDI "${midiTitle}" deleted successfully.` });
        // Fetch lại dữ liệu cho trang hiện tại sau khi xóa
        // Hoặc nếu số lượng item trên trang hiện tại bằng 1 và không phải trang 1, thì lùi về trang trước
        if (myMidis.length === 1 && currentPage > 1) {
            setCurrentPage(prevPage => prevPage - 1); // Sẽ trigger fetchMyMidis ở useEffect
        } else {
            fetchMyMidis(currentPage); // Fetch lại trang hiện tại
        }
      } catch (err) {
        console.error("Failed to delete MIDI", err);
        setPageMessage({ type: 'error', content: `Could not delete MIDI: ${err.response?.data?.msg || err.message}` });
      }
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
      // useEffect của currentPage sẽ trigger fetchMyMidis
      window.scrollTo(0, 0);
    }
  };


  if (authLoading || (isLoading && !myMidis.length && currentPage === 1)) {
    return (
      <div className="loading-container-page">
        <div className="spinner-page"></div>
        <p>Loading Your MIDIs...</p>
      </div>
    );
  }

  if (error && !myMidis.length) {
    return <p className="error-message-page container">{error}</p>;
  }

  return (
    <div className="my-midis-page-container container">
      <header className="my-midis-header">
        <div className="header-title-group">
          <FaMusic className="header-icon" />
          <h1>My Uploaded MIDIs <span className="my-midis-count">({totalMidiCount})</span></h1>
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
      {error && myMidis.length > 0 && <p className="alert-message alert-error container">{error}</p>}

      {isLoading && myMidis.length > 0 && (
        <div className="loading-container-inline">
            <div className="spinner-inline"></div> Loading...
        </div>
      )}

      {!isLoading && myMidis.length === 0 && !error && (
        <div className="no-midis-message">
          <p>You haven't uploaded any MIDIs yet.</p>
          <Link to="/upload" className="btn btn-secondary">Upload Your First MIDI</Link>
        </div>
      )}

      {myMidis.length > 0 && (
        <>
          <div className="midi-grid my-midis-grid">
            {myMidis.map((midi) => (
              <div key={midi._id} className="my-midi-card-wrapper">
                <MidiCard midi={midi} />
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
          {totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
};

export default MyMidisPage;