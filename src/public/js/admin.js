/* =========================================================
   WINMART ADMIN PANEL - JAVASCRIPT
========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    
    initSidebar();
    
    initDataTable();
    
    initConfirmDialogs();
    
    initAutoNumeric();
    
    initCharts();
    
    initQuickActions();
    
    initNotifications();
    
});

/* =========================================================
   SIDEBAR NAVIGATION
========================================================= */

function initSidebar() {
    
    // Active nav link highlight
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.admin-sidebar .nav-link');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
            
            // Expand parent section if needed
            const parentCollapse = link.closest('.collapse');
            if (parentCollapse) {
                parentCollapse.classList.add('show');
            }
        }
    });
    
    // Mobile sidebar toggle
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.admin-sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth < 992) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        }
    });
    
}

/* =========================================================
   DATA TABLE ENHANCEMENTS
========================================================= */

function initDataTable() {
    
    // Search functionality
    const searchInputs = document.querySelectorAll('[data-search]');
    
    searchInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const tableId = input.getAttribute('data-search');
            const table = document.getElementById(tableId);
            
            if (!table) return;
            
            const rows = table.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    });
    
    // Sort functionality
    const sortHeaders = document.querySelectorAll('[data-sort]');
    
    sortHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const tableId = header.getAttribute('data-sort');
            const columnIndex = header.getAttribute('data-column');
            const table = document.getElementById(tableId);
            
            if (!table) return;
            
            sortTable(table, columnIndex);
        });
    });
    
}

function sortTable(table, columnIndex) {
    
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const isAscending = table.dataset.sortOrder === 'asc';
    
    rows.sort((a, b) => {
        const aValue = a.querySelectorAll('td')[columnIndex]?.textContent.trim();
        const bValue = b.querySelectorAll('td')[columnIndex]?.textContent.trim();
        
        if (!aValue || !bValue) return 0;
        
        // Try to parse as number
        const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ''));
        const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ''));
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return isAscending ? aNum - bNum : bNum - aNum;
        }
        
        // String comparison
        return isAscending 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
    });
    
    // Re-append sorted rows
    rows.forEach(row => table.querySelector('tbody').appendChild(row));
    
    // Toggle sort order
    table.dataset.sortOrder = isAscending ? 'desc' : 'asc';
    
}

/* =========================================================
   CONFIRM DIALOGS
========================================================= */

function initConfirmDialogs() {
    
    document.addEventListener('click', (e) => {
        const confirmBtn = e.target.closest('[data-confirm]');
        
        if (confirmBtn) {
            e.preventDefault();
            
            const message = confirmBtn.getAttribute('data-confirm');
            const action = confirmBtn.getAttribute('data-action');
            
            if (confirm(message)) {
                if (action === 'delete') {
                    // Handle delete action
                    const form = confirmBtn.closest('form');
                    if (form) {
                        form.submit();
                    } else {
                        // Redirect if no form
                        const href = confirmBtn.getAttribute('href');
                        if (href) {
                            window.location.href = href;
                        }
                    }
                }
            }
        }
    });
    
}

/* =========================================================
   AUTO NUMERIC (CURRENCY FORMAT)
========================================================= */

function initAutoNumeric() {
    
    const currencyInputs = document.querySelectorAll('[data-currency]');
    
    currencyInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^\d]/g, '');
            
            if (value) {
                const number = parseInt(value, 10);
                e.target.value = number.toLocaleString('vi-VN');
            }
        });
    });
    
}

/* =========================================================
   CHARTS (Chart.js)
========================================================= */

function initCharts() {
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') return;
    
    const revenueChart = document.getElementById('revenueChart');
    const orderChart = document.getElementById('orderChart');
    
    if (revenueChart) {
        new Chart(revenueChart, {
            type: 'line',
            data: {
                labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
                datasets: [{
                    label: 'Doanh thu (triệu đồng)',
                    data: [12, 19, 15, 25, 22, 30, 28],
                    borderColor: '#e11d48',
                    backgroundColor: 'rgba(225, 29, 72, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    if (orderChart) {
        new Chart(orderChart, {
            type: 'doughnut',
            data: {
                labels: ['Hoàn tất', 'Chờ xử lý', 'Đã hủy'],
                datasets: [{
                    data: [65, 25, 10],
                    backgroundColor: [
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
}

/* =========================================================
   QUICK ACTIONS
========================================================= */

function initQuickActions() {
    
    // Quick add product
    const quickAddBtn = document.querySelector('[data-quick-add]');
    
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            // Show modal or redirect
            const modal = document.getElementById('quickAddModal');
            if (modal) {
                const bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            } else {
                window.location.href = '/admin/products/create';
            }
        });
    }
    
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function initNotifications() {
    
    // Tự động đóng thông báo sau 3.5 giây
    const alerts = document.querySelectorAll('.alert-dismissible');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
            bsAlert.close();
        }, 3500);
    });
    
    // Fetch new notifications periodically
    setInterval(() => {
        fetchNotifications();
    }, 60000); // Every 60 seconds
    
}

function fetchNotifications() {
    
    // TODO: Implement API call to fetch new notifications
    // fetch('/api/notifications')
    //   .then(res => res.json())
    //   .then(data => {
    //       updateNotificationBadge(data.count);
    //   });
    
}

function updateNotificationBadge(count) {
    
    const badge = document.querySelector('.notification-badge');
    
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }
    
}

/* =========================================================
   UTILITY FUNCTIONS
========================================================= */

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export to CSV
function exportToCSV(tableId, filename = 'export.csv') {
    
    const table = document.getElementById(tableId);
    
    if (!table) return;
    
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const csvRow = [];
        
        cols.forEach(col => {
            csvRow.push('"' + col.textContent.trim() + '"');
        });
        
        csv.push(csvRow.join(','));
    });
    
    downloadCSV(csv.join('\n'), filename);
    
}

function downloadCSV(csv, filename) {
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
}

// Make functions globally available
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.exportToCSV = exportToCSV;