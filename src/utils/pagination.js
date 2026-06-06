'use strict';

const { pagination: cfg } = require('../config/app.config');

/**
 * Tính toán tham số phân trang cho MySQL OFFSET/LIMIT
 * @param {number|string} page - Trang hiện tại (1-based)
 * @param {number|string} limit - Số bản ghi mỗi trang
 * @returns {{ limit: number, offset: number, page: number, meta: Function }}
 */
function paginate(page = 1, limit = cfg.defaultLimit) {
  // Validate & sanitize
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(cfg.maxLimit, Math.max(1, parseInt(limit, 10) || cfg.defaultLimit));
  const offset = (p - 1) * l;

  /**
   * Tạo metadata sau khi có total từ database
   * @param {number} total - Tổng số bản ghi (từ COUNT query)
   * @returns {Object} Meta info cho frontend
   */
  function meta(total) {
    const totalPages = Math.max(1, Math.ceil(total / l));
    const currentPage = Math.min(p, totalPages); // Clamp page không vượt total
    
    return {
      total,
      totalPages,
      currentPage,
      perPage: l,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      // Hữu ích cho frontend build pagination links
      links: {
        first: `?page=1&limit=${l}`,
        last: `?page=${totalPages}&limit=${l}`,
        next: currentPage < totalPages ? `?page=${currentPage + 1}&limit=${l}` : null,
        prev: currentPage > 1 ? `?page=${currentPage - 1}&limit=${l}` : null,
      },
    };
  }

  return { limit: l, offset, page: p, meta };
}

module.exports = { paginate };