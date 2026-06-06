'use strict';

/**
 * Xây dựng mệnh đề WHERE động từ object filters.
 * Hỗ trợ operators: =, !=, >, >=, <, <=, LIKE, IN
 * 
 * @param {Object} filters - { column: value } hoặc { column: { op, value } }
 * @param {Object} options - { tableAlias: 'p' } để prefix column
 * @returns {{ where: string, params: Array }}
 * 
 * @example
 * buildWhere({ 
 *   status: 'ACTIVE', 
 *   price: { op: '>=', value: 10000 },
 *   name: '%áo%'  // LIKE
 * })
 * // → { where: 'WHERE status = ? AND price >= ? AND name LIKE ?', params: [...] }
 */
function buildWhere(filters = {}, options = {}) {
  const clauses = [];
  const params = [];
  const alias = options.tableAlias ? `${options.tableAlias}.` : '';

  for (const [col, val] of Object.entries(filters)) {
    // Skip null/undefined/empty
    if (val === undefined || val === null || val === '') continue;

    const column = `${alias}${col}`;

    // Case 1: Object với operator tùy chỉnh
    if (typeof val === 'object' && val.op && val.value !== undefined) {
      const op = val.op.toUpperCase();
      const allowedOps = ['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'IN', 'NOT IN'];
      if (!allowedOps.includes(op)) continue; // Bỏ qua op không an toàn
      
      if (op === 'IN' || op === 'NOT IN') {
        const values = Array.isArray(val.value) ? val.value : [val.value];
        if (values.length === 0) continue;
        const placeholders = values.map(() => '?').join(',');
        clauses.push(`${column} ${op} (${placeholders})`);
        params.push(...values);
      } else {
        clauses.push(`${column} ${op} ?`);
        params.push(val.value);
      }
    }
    // Case 2: String có % → LIKE
    else if (typeof val === 'string' && val.includes('%')) {
      clauses.push(`${column} LIKE ?`);
      params.push(val);
    }
    // Case 3: Default =
    else {
      clauses.push(`${column} = ?`);
      params.push(val);
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

/**
 * Xây dựng ORDER BY động
 * @param {string|Object} sortBy - 'name' hoặc { column: 'price', direction: 'DESC' }
 * @param {Array} allowedColumns - Whitelist columns để tránh SQL injection
 * @returns {string} ORDER BY clause hoặc rỗng
 */
function buildOrderBy(sortBy, allowedColumns = []) {
  if (!sortBy) return '';
  
  let column, direction = 'ASC';
  if (typeof sortBy === 'object') {
    column = sortBy.column;
    direction = sortBy.direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  } else {
    column = sortBy;
  }
  
  // Security: Chỉ cho phép column trong whitelist
  if (!allowedColumns.includes(column)) return '';
  
  return `ORDER BY ${column} ${direction}`;
}

module.exports = { buildWhere, buildOrderBy };