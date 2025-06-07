import React from 'react';
import { Link } from 'react-router-dom';
import { trackMidiDownload } from '../../services/apiMidis';
import '../../assets/css/MidiCard.css'; // Tạo file CSS

// Helper function to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
        return 'N/A';
    }
};


const MidiCard = ({ midi }) => {
  const handleDownload = async () => {
    try {
      // Theo dõi lượt download
      const res = await trackMidiDownload(midi.id);
      // Mở link download trong tab mới (link này sẽ được phục vụ bởi static route của server webapp)
      // `midi.file_path` nên là đường dẫn tương đối như `/uploads/filename.mid`
      // hoặc `res.data.download_path` nếu API download trả về đường dẫn
      const downloadUrl = `${window.location.origin}${midi.file_path || res.data.download_path}`;
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error("Error tracking download or initiating download:", error);
      alert("Could not initiate download. Please try again.");
    }
  };

  return (
    <div className="midi-card">
      {/* Bạn có thể thêm ảnh thumbnail nếu có */}
      {/* <img src={midi.thumbnailUrl || '/placeholder-image.png'} alt={midi.title} className="midi-thumbnail" /> */}
      <div className="midi-card-content">
        <h3><Link to={`/midi/${midi.id}`}>{midi.title}</Link></h3>
        <p className="artist">{midi.artist || 'Unknown Artist'}</p>
        <p className="details">{midi.size_kb} KB {midi.bpm ? `• ${midi.bpm} BPM` : ''}</p>
        {midi.arrangement_by && <p className="arrangement">Arrangement by: {midi.arrangement_by}</p>}
        <p className="uploader">Uploaded by: {midi.uploader_username || 'Unknown'}</p>

        <div className="midi-stats">
          <span>👁️ {midi.views || 0} Views</span>
          <span>📥 {midi.downloads || 0} Downloads</span>
          <span>📅 {formatDate(midi.upload_date)}</span>
        </div>

        <div className="midi-actions">
          <button onClick={handleDownload} className="btn btn-download">DOWNLOAD</button>
          <Link to={`/midi/${midi.id}`} className="btn btn-view">VIEW</Link>
        </div>
      </div>
    </div>
  );
};

export default MidiCard;