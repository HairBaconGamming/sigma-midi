// client/src/components/layout/PaginationControls.jsx
import React, { useState, useEffect } from 'react';
import { FaAngleLeft, FaAngleRight, FaAngleDoubleLeft, FaAngleDoubleRight } from 'react-icons/fa';
// CSS cho component này sẽ được thêm vào HomePage.css hoặc file riêng
import '../../assets/css/PaginationControls.css'; 

const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
  const [inputPage, setInputPage] = useState(currentPage.toString());

  useEffect(() => {
    setInputPage(currentPage.toString());
  }, [currentPage]);

  const handleInputChange = (e) => {
    setInputPage(e.target.value);
  };

  const handleGoToPage = (e) => {
    e.preventDefault();
    const pageNum = parseInt(inputPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    } else {
      // Tùy chọn: hiển thị lỗi hoặc reset input
      setInputPage(currentPage.toString());
    }
  };

  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5; // Số lượng nút trang tối đa hiển thị (không tính first, last, prev, next)
    const halfPagesToShow = Math.floor(maxPagesToShow / 2);

    let startPage = Math.max(1, currentPage - halfPagesToShow);
    let endPage = Math.min(totalPages, currentPage + halfPagesToShow);

    if (currentPage - halfPagesToShow < 1) {
      endPage = Math.min(totalPages, maxPagesToShow);
    }
    if (currentPage + halfPagesToShow > totalPages) {
      startPage = Math.max(1, totalPages - maxPagesToShow + 1);
    }
    
    // Nút "Đầu"
    if (currentPage > 1) {
        pageNumbers.push(
            <button
                key="first"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                className="pagination-btn"
                title="First Page"
            >
                <FaAngleDoubleLeft /> <span className="pagination-btn-text">First</span>
            </button>
        );
    }

    // Nút "Trở về"
     pageNumbers.push(
        <button
            key="prev"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-btn"
            title="Previous Page"
        >
            <FaAngleLeft /> <span className="pagination-btn-text">Back</span>
        </button>
    );


    if (startPage > 1) {
      pageNumbers.push(<button key={1} onClick={() => onPageChange(1)} className="pagination-btn page-number">1</button>);
      if (startPage > 2) {
        pageNumbers.push(<span key="start-ellipsis" className="pagination-ellipsis">...</span>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          className={`pagination-btn page-number ${currentPage === i ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.push(<span key="end-ellipsis" className="pagination-ellipsis">...</span>);
      }
      pageNumbers.push(<button key={totalPages} onClick={() => onPageChange(totalPages)} className="pagination-btn page-number">{totalPages}</button>);
    }

    // Nút "Tiếp theo"
    pageNumbers.push(
        <button
            key="next"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="pagination-btn"
            title="Next Page"
        >
           <span className="pagination-btn-text">Next</span> <FaAngleRight />
        </button>
    );
    
    // Nút "Cuối"
    if (currentPage < totalPages) {
        pageNumbers.push(
            <button
                key="last"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="pagination-btn"
                title="Last Page"
            >
                <span className="pagination-btn-text">Last</span> <FaAngleDoubleRight />
            </button>
        );
    }


    return pageNumbers;
  };

  return (
    <div className="pagination-controls-wrapper"> {/* Wrapper này giờ sẽ nhận style từ file CSS riêng */}
      <div className="pagination-buttons">
        {renderPageNumbers()}
      </div>
      {totalPages > 1 && (
        <form onSubmit={handleGoToPage} className="pagination-goto-form">
          <input
            type="number"
            min="1"
            max={totalPages}
            value={inputPage}
            onChange={handleInputChange}
            className="pagination-input"
            aria-label="Go to page"
          />
          <button type="submit" className="btn pagination-go-btn">Go</button>
        </form>
      )}
    </div>
  );
};

export default PaginationControls;