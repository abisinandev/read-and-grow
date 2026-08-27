// Chart instances
let doughnutChart, salesOverviewChart;

// Chart data storage
const chartData = {
    salesLabels: [],
    salesData: [],
    categoryLabels: [],
    categoryData: []
};

// DOM elements
const elements = {
    filterSelect: document.getElementById('filterSelect'),
    filterForm: document.getElementById('filterForm'),
    startDateDiv: document.getElementById('startDateDiv'),
    endDateDiv: document.getElementById('endDateDiv'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    startDateError: document.getElementById('startDateError'),
    endDateError: document.getElementById('endDateError'),
    totalSales: document.getElementById('totalSales'),
    totalOrders: document.getElementById('totalOrders'),
    totalCoupons: document.getElementById('totalCoupons'),
    totalProductSold: document.getElementById('totalProductSold'),
    topSellingBooks: document.getElementById('topSellingBooks')
};
// Debug the elements object to check for null
console.log('Elements at initialization:', elements);

// Toggle custom date inputs
elements.filterSelect.addEventListener('change', () => {
    const isCustom = elements.filterSelect.value === 'custom';
    elements.startDateDiv.classList.toggle('hidden', !isCustom);
    elements.endDateDiv.classList.toggle('hidden', !isCustom);
});

// Form submission handler
elements.filterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const filter = elements.filterSelect.value;
    resetErrors();
    if (filter === 'custom' && !validateCustomDates()) {
        return;
    }
    const queryParams = new URLSearchParams({ filter });
    if (filter === 'custom') {
        queryParams.append('startDate', elements.startDate.value);
        queryParams.append('endDate', elements.endDate.value);
    }
    try {
        const response = await fetch(`/admin/update-dashboard?${queryParams.toString()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Filter operation failed');
        updateChartData(data);
        updateSummaryCards(data);
        updateCharts();
        showToast(`Data updated for ${filter} view`, 'green');
    } catch (error) {
        console.error('Error:', error);
        showToast(error.message || 'Filter operation failed', 'red');
    }
});

// Reset error messages
function resetErrors() {
    elements.startDateError.classList.add('hidden');
    elements.endDateError.classList.add('hidden');
    elements.startDateError.textContent = '';
    elements.endDateError.textContent = '';
}

// Validate custom date range
function validateCustomDates() {
    let isValid = true;

    if (!elements.startDate.value) {
        elements.startDateError.textContent = 'Start date is required';
        elements.startDateError.classList.remove('hidden');
        isValid = false;
    }

    if (!elements.endDate.value) {
        elements.endDateError.textContent = 'End date is required';
        elements.endDateError.classList.remove('hidden');
        isValid = false;
    }

    if (elements.startDate.value && elements.endDate.value) {
        const startDate = new Date(elements.startDate.value);
        const endDate = new Date(elements.endDate.value);
        if (endDate < startDate) {
            elements.endDateError.textContent = 'End date must be after start date';
            elements.endDateError.classList.remove('hidden');
            isValid = false;
        }
    }

    return isValid;
}

// Show toast notification
function showToast(message, bgColor) {
    Toastify({
        text: message,
        duration: 3000,
        backgroundColor: bgColor,
    }).showToast();
}

// Update chart data from API response
function updateChartData(data) {
    if (data.dailySales) {
        chartData.salesLabels = data.dailySales.map(item => item._id);
        chartData.salesData = data.dailySales.map(item => item.totalSales);
    }
    if (data.categoryBasedSales) {
        chartData.categoryLabels = Object.keys(data.categoryBasedSales);
        chartData.categoryData = Object.values(data.categoryBasedSales);
    }
}

// Update all charts
function updateCharts() {
    updateChart(doughnutChart, chartData.categoryLabels, chartData.categoryData);
    updateChart(salesOverviewChart, chartData.salesLabels, chartData.salesData);
}

// Helper to update a chart
function updateChart(chart, labels, data) {
    if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update();
    }
}

// Initialize dashboard
async function initializeDashboard() {
    try {
        const response = await fetch('/admin/update-dashboard?filter=monthly', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.message || 'Failed to load dashboard data');

        updateChartData(data);
        updateTopSellingBooks(data)
        updateSummaryCards(data);
        initializeCharts();
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to load dashboard data', 'red');
    }
}

// Update summary cards
function updateSummaryCards(data) {
    elements.totalSales.textContent = `₹${data.totalSales[0]?.totalSum || 0}`;
    elements.totalOrders.textContent = data.deliveredOrdersCount || 0;
    elements.totalCoupons.textContent = data.totalCoupons || 0;
    elements.totalProductSold.textContent = data.countProducts[0]?.totalSoldProducts || 0;
}

// Initialize all charts
function initializeCharts() {
    doughnutChart = createDoughnutChart('myDoughnutChart', chartData.categoryLabels, chartData.categoryData);
    salesOverviewChart = createLineChart('salesOverview', chartData.salesLabels, chartData.salesData);
}


function updateTopSellingBooks(data) {
    elements.topSellingBooks.textContent = ''; // Clear previous content
    
    data.topSellingBooks.forEach((book, index) => {
        const li = document.createElement('li');
        li.className = 'flex items-center p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition duration-300 mb-3';
        
        li.innerHTML = `
            <div class="flex-shrink-0 mr-4 relative">
                <img src="${book.images[0] || '/api/placeholder/64/96'}" alt="${book.name}" class="w-16 h-24 object-cover rounded shadow">
                <div class="absolute -top-2 -left-2 bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">${index + 1}</div>
            </div>
            <div class="flex-grow">
                <h4 class="font-medium text-gray-900">${book.name}</h4>
                <p class="text-sm text-gray-600">${book.authorName || 'Unknown Author'}</p>
            </div>
        `;
        
        elements.topSellingBooks.appendChild(li);
    });
}

// Doughnut chart configuration
function createDoughnutChart(canvasId, labels, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                label: 'Sales Distribution by Category',
                data,
                backgroundColor: ['rgb(200, 30, 60)', 'rgb(30, 100, 180)', 'rgb(180, 150, 40)', 'rgb(20, 120, 120)', 'rgb(100, 70, 200)'],
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Category-wise Sales Distribution' }
            }
        }
    });
}

// Line chart configuration
function createLineChart(canvasId, labels, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Sales Trend',
                data,
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.3,
                pointBackgroundColor: 'rgb(75, 192, 192)',
                pointBorderColor: '#fff',
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 14 } } },
                tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleFont: { size: 16 }, bodyFont: { size: 14 }, padding: 12, caretSize: 10, cornerRadius: 6 }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { font: { size: 12 } } },
                x: { grid: { display: false }, ticks: { font: { size: 12 } } }
            },
            interaction: { intersect: false, mode: 'index' },
            animation: { duration: 1500, easing: 'easeOutQuart' }
        }
    });
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);