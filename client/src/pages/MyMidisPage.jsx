import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllMidis } from '../services/apiMidis'; // Assuming this can filter by uploader_id
import MidiCard from '../components/midis/MidiCard';
// import '../assets/css/MyMidisPage.css'; // Tạo file CSS này sau
import { FaMusic, FaPlusCircle } from 'react-icons/fa';


const MyMidisPage = () => {
  const { user, loading: authLoading, token } = useAuth();
  const [myMidis, setMyMidis] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMyMidis = useCallback(async () => {
    if (user && token) {
      setIsLoading(true);
      try {
        const params = {
          uploaderId: user.id, // API cần hỗ trợ filter này
          sortBy: 'upload_date',
          order: 'desc',
          // is_public: 'all' // Thêm một tham số để lấy cả public và private nếu có
        };
        const res = await getAllMidis(params);
        // getAllMidis có thể trả về { midis: [], totalItems: X, ... }
        setMyMidis(res.data.midis || res.data || []); // Xử lý cả hai trường hợp trả về
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

  // const handleDeleteMidi = async (midiId) => {
  //   if (window.confirm("Are you sure you want to delete this MIDI? This action cannot be undone.")) {
  //     try {
  //       // await api.delete(`/midis/${midiId}`); // Endpoint xóa MIDI
  //       // setMyMidis(myMidis.filter(midi => midi.id !== midiId));
  //       alert("MIDI deleted successfully (placeholder).");
  //     } catch (err) {
  //       console.error("Failed to delete MIDI", err);
  //       alert("Could not delete MIDI.");
  //     }
  //   }
  // };


  if (authLoading || isLoading) {
    return (
      <div className="loading-container-page">
        <div className="spinner-page"></div>
        <p>Loading Your MIDIs...</p>
      </div>
    );
  }

  if (error) {
    return <p className="error-message-page">{error}</p>;
  }

  return (
    <div className="my-midis-page-container container"> {/* Thêm class container */}
      <header className="my-midis-header">
        <FaMusic className="header-icon" />
        <h1>My Uploaded MIDIs</h1>
        <Link to="/upload" className="btn btn-primary btn-upload-new">
          <FaPlusCircle /> Upload New MIDI
        </Link>
      </header>

      {myMidis.length === 0 ? (
        <div className="no-midis-message">
          <p>You haven't uploaded any MIDIs yet.</p>
          <Link to="/upload" className="btn btn-secondary">Upload Your First MIDI</Link>
        </div>
      ) : (
        <div className="midi-grid my-midis-grid">
          {myMidis.map((midi) => (
            <div key={midi.id} className="my-midi-card-wrapper">
              <MidiCard midi={midi} />
              {/* <div className="my-midi-actions">
                <Link to={`/midi/edit/${midi.id}`} className="btn btn-outline-primary btn-edit-midi">Edit</Link>
                <button onClick={() => handleDeleteMidi(midi.id)} className="btn btn-danger btn-delete-midi">Delete</button>
              </div> */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyMidisPage;