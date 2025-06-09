// client/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { getAllMidis } from "../services/apiMidis";
import MidiCard from "../components/midis/MidiCard";
import PaginationControls from "../components/layout/PaginationControls"; // TẠO COMPONENT NÀY
import {
  FaSearch,
  FaSortAmountDown,
  FaSortAmountUp,
  FaFolderOpen,
} from "react-icons/fa";
import "../assets/css/HomePage.css";

// Debounce function (giữ nguyên)
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(null, args);
    }, delay);
  };
};

const ITEMS_PER_PAGE = 12; // Hoặc lấy từ config, hoặc cho người dùng chọn

const HomePage = () => {
  const [midis, setMidis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("upload_date");
  const [order, setOrder] = useState("desc");
  const [totalFiles, setTotalFiles] = useState(0);

  // State cho phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // itemsPerPage có thể là hằng số hoặc state nếu bạn muốn người dùng thay đổi

  const fetchMidis = useCallback(
    async (pageToFetch, currentSearchTerm, currentSortBy, currentOrder) => {
      setLoading(true);
      setError("");
      try {
        const params = {
          search: currentSearchTerm,
          sortBy: currentSortBy,
          order: currentOrder,
          page: pageToFetch, // Sử dụng pageToFetch
          limit: ITEMS_PER_PAGE,
        };
        const res = await getAllMidis(params);
        if (res.data && Array.isArray(res.data.midis)) {
          setMidis(res.data.midis);
          setTotalFiles(res.data.totalItems || 0); // Sử dụng totalItems từ API
          setTotalPages(res.data.totalPages || 1); // Sử dụng totalPages từ API
          setCurrentPage(res.data.currentPage || 1); // Cập nhật currentPage từ API
        } else {
          setMidis([]);
          setTotalFiles(0);
          setTotalPages(1);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error(
          "Failed to fetch MIDIs",
          err.response ? err.response.data : err.message
        );
        setError(
          "Failed to load MIDIs. The server might be down or an error occurred."
        );
        setMidis([]);
        setTotalFiles(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    []
  ); // Bỏ ITEMS_PER_PAGE nếu nó là hằng số

  const debouncedFetchMidis = useCallback(
    debounce((...args) => fetchMidis(1, ...args.slice(1)), 500),
    [fetchMidis]
  );
  // Khi search/sort, luôn fetch trang 1

  useEffect(() => {
    // Fetch khi page, sort, hoặc order thay đổi trực tiếp
    fetchMidis(currentPage, searchTerm, sortBy, order);
  }, [currentPage, sortBy, order, fetchMidis]); // Bỏ searchTerm vì nó được xử lý bởi debouncedFetchMidis

  useEffect(() => {
    // Debounced fetch cho search term changes, luôn reset về trang 1
    if (searchTerm !== "") {
      // Chỉ debounce khi có search term
      debouncedFetchMidis(1, searchTerm, sortBy, order); // Luôn fetch trang 1 khi search
    } else if (searchTerm === "" && midis.length === 0 && !loading) {
      // Nếu search term rỗng và chưa có data
      fetchMidis(1, "", sortBy, order); // Fetch lại trang 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, debouncedFetchMidis, sortBy, order]); // Không cần fetchMidis ở đây nữa

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    // Việc reset về trang 1 sẽ được xử lý bởi useEffect của searchTerm
  };

  const handleSortByChange = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1); // Reset về trang 1 khi đổi sort
  };

  const handleOrderChange = (e) => {
    setOrder(e.target.value);
    setCurrentPage(1); // Reset về trang 1 khi đổi order
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
      // useEffect của currentPage sẽ trigger fetchMidis
      window.scrollTo(0, 0); // Cuộn lên đầu trang khi chuyển trang
    }
  };

  return (
    <div className="homepage-container">
      <header className="repository-header-container">
        <FaFolderOpen className="repository-icon" />
        <h1 className="repository-title">
          sigmaMIDI Repository
          <span className="repository-count">
            ({loading && midis.length === 0 ? "..." : totalFiles} MIDI files)
          </span>
        </h1>
      </header>

      <div className="controls-bar-container">
        {/* Search and Sort controls (giữ nguyên) */}
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
            <select
              value={sortBy}
              onChange={handleSortByChange}
              className="sort-select-field"
            >
              <option value="upload_date">Newest</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="views">Most Viewed</option>
              <option value="downloads">Most Downloaded</option>
              <option value="bpm">BPM</option>
              <option value="size_bytes">File Size</option>
            </select>
          </div>
          <div className="select-wrapper">
            <select
              value={order}
              onChange={handleOrderChange}
              className="sort-select-field"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
            {order === "desc" ? (
              <FaSortAmountDown className="sort-icon-indicator" />
            ) : (
              <FaSortAmountUp className="sort-icon-indicator" />
            )}
          </div>
        </div>
      </div>

      {loading &&
        midis.length === 0 && ( // Chỉ hiển thị loading toàn trang nếu chưa có MIDI nào
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading MIDIs...</p>
          </div>
        )}
      {error && <p className="error-message-global">{error}</p>}
      {!loading && !error && midis.length === 0 && totalFiles === 0 && (
        <p className="no-results-message">
          No MIDIs found matching your criteria. Try adjusting your search or
          upload a new one!
        </p>
      )}

      {/* Luôn hiển thị grid nếu có midis, ngay cả khi đang loading thêm */}
      {midis.length > 0 && (
        <div className="midi-grid">
          {midis.map((midi) => (
            <MidiCard key={midi._id} midi={midi} />
          ))}
        </div>
      )}
      {loading &&
        midis.length > 0 && ( // Hiển thị loading nhỏ ở cuối nếu đang load thêm trang
          <div
            className="loading-container-inline"
            style={{ marginTop: "var(--spacing-lg)" }}
          >
            <div className="spinner-inline"></div> Loading more...
          </div>
        )}

      {!loading && totalPages > 1 && (
        <div className="pagination-section">
          {" "}
          {/* Thêm một div wrapper nếu cần */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
};

export default HomePage;
