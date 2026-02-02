import React, { useState, useEffect } from 'react';
import './Pagination.css';

function Pagination({ 
  totalSize = 0, 
  newNum = 0, 
  latestDate = '', 
  currentPage = 1, 
  pageSize = 40,
  onPageChange,
  showStats = true
}) {
  const [goToPage, setGoToPage] = useState(currentPage);
  const totalPages = Math.ceil(totalSize / pageSize);

  useEffect(() => {
    setGoToPage(currentPage);
  }, [currentPage]);

  // 格式化数字显示（添加千分位分隔符）
  const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 格式化日期时间显示
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    return dateStr;
  };

  // 生成页码按钮数组
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7; // 最多显示7个页码按钮
    
    if (totalPages <= maxVisible) {
      // 如果总页数少于等于7，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 如果总页数大于7，显示部分页码
      if (currentPage <= 4) {
        // 当前页在前4页，显示 1,2,3,4,5,6,...,last
        for (let i = 1; i <= 6; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // 当前页在后4页，显示 1,...,last-5,last-4,last-3,last-2,last-1,last
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 5; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // 当前页在中间，显示 1,...,current-1,current,current+1,...,last
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const handlePageClick = (page) => {
    if (page === currentPage || page < 1 || page > totalPages) {
      return;
    }
    if (onPageChange) {
      onPageChange(page);
    }
  };

  const handleGoToPage = (e) => {
    e.preventDefault();
    const page = parseInt(goToPage);
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      handlePageClick(page);
    } else {
      setGoToPage(currentPage);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      handlePageClick(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageClick(currentPage + 1);
    }
  };

  if (totalSize === 0) {
    return null;
  }

  const pageNumbers = getPageNumbers();

  return (
    <div className="pagination-container">
      {showStats && (
        <div className="pagination-stats">
          <div className="stat-item">
            <span className="stat-label">共</span>
            <span className="stat-value">{formatNumber(totalSize)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">新增</span>
            <span className="stat-value">{formatNumber(newNum)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">更新时间</span>
            <span className="stat-value">{formatDateTime(latestDate)}</span>
          </div>
        </div>
      )}

      {/* 分页控件 */}
      <div className="pagination-controls">
        <button 
          className="pagination-btn prev-btn" 
          onClick={handlePrevPage}
          disabled={currentPage === 1}
        >
          &lt;
        </button>
        
        {pageNumbers.map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <button key={`ellipsis-${index}`} className="pagination-btn ellipsis-btn" disabled>
                ...
              </button>
            );
          }
          
          return (
            <button
              key={page}
              className={`pagination-btn page-btn ${page === currentPage ? 'active' : ''}`}
              onClick={() => handlePageClick(page)}
            >
              {page}
            </button>
          );
        })}
        
        <button 
          className="pagination-btn next-btn" 
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
        >
          &gt;
        </button>

        <div className="pagination-goto">
          <span className="goto-label">前往</span>
          <form onSubmit={handleGoToPage}>
            <input
              type="number"
              className="goto-input"
              value={goToPage}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                setGoToPage(Math.max(1, Math.min(value, totalPages)));
              }}
              min={1}
              max={totalPages}
            />
          </form>
          <span className="goto-label">页</span>
        </div>
      </div>
    </div>
  );
}

export default Pagination;
