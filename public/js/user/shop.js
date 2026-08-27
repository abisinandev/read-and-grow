
// NOTE: showToast(), addToCart()/isAddToCart, and initMobileFilters() are intentionally
// NOT redefined here — they're already declared globally by showMessage.js, which this
// page loads before shop.js. Redeclaring `let isAddToCart` a second time in the same
// (non-module) global scope throws a SyntaxError that aborts this entire script before
// any listener below gets attached, silently breaking filtering/sorting/pagination.

document.addEventListener('DOMContentLoaded', function () {
    console.log("Shop page initialized");

    // DOM Elements
    const searchForm = document.getElementById('searchForm');
    const mobileSearchForm = document.getElementById('mobileSearchForm');
    const bookGrid = document.querySelector('.grid');
    const pagination = document.querySelector('.flex.justify-center.mt-6');
    const limit = document.getElementById('limit')?.value || 6;
    const body = document.body;



    // Mobile filter functionality
    initMobileFilters();

    // Get current filter attributes
    const currentFilters = {
        search: body.getAttribute("data-search") || "",
        category: body.getAttribute("data-category") || "",
        author: body.getAttribute("data-author") || "",
        price: body.getAttribute("data-price") || "",
        sort: body.getAttribute("data-sort") || ""
    };

    // Highlight active filters in sidebar
    highlightActiveFilters();

    // Event Listeners
    searchForm?.addEventListener("submit", filterProducts);
    mobileSearchForm?.addEventListener("submit", filterProducts);

    // Filter click handlers
    document.querySelectorAll('.filter-link').forEach(link => {
        link.addEventListener('click', async function (event) {
            event.preventDefault();

            const filterType = this.getAttribute('data-filter');
            const filterValue = this.getAttribute('data-value');

            if (filterType === 'category' && filterValue === 'all') {
                // "All Categories" clears every active filter, not just category
                currentFilters.search = '';
                currentFilters.category = '';
                currentFilters.author = '';
                currentFilters.price = '';
                currentFilters.sort = '';

                // Reflect the reset in the search inputs and sort dropdowns too
                document.querySelectorAll('input[name="search"]').forEach(input => { input.value = ''; });
                document.querySelectorAll('select[name="sortOptions"]').forEach(select => { select.value = 'default'; });
            } else if (filterType) {
                if (filterValue === 'all') {
                    currentFilters[filterType] = '';
                } else {
                    currentFilters[filterType] = filterValue;
                }
            }

            // Reset to page 1 on filter change
            const url = buildUrl(1, currentFilters);
            await fetchAndUpdate(url);

            // Close mobile filter sidebar if open
            const filterSidebar = document.getElementById('filterSidebar');
            const filterOverlay = document.getElementById('filterOverlay');
            if (filterSidebar?.classList.contains('active')) {
                filterSidebar.classList.remove('active');
                filterOverlay?.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Sort selection handler
    document.querySelectorAll('select[name="sortOptions"]').forEach(select => {
        select.addEventListener('change', async function (event) {
            const val = this.value;
            const sortVal = val.replace('/sort/', '').replace('/shop', ''); // clean it up if it has old path
            currentFilters.sort = (sortVal === 'default' || !sortVal) ? '' : sortVal;
            const url = buildUrl(1, currentFilters);
            await fetchAndUpdate(url);

            // Sync all sort dropdowns
            document.querySelectorAll('select[name="sortOptions"]').forEach(s => {
                if (s !== this) s.value = this.value;
            });
        });
    });

    // Apply filters button for mobile
    document.getElementById('applyFilters')?.addEventListener('click', function () {
        const filterSidebar = document.getElementById('filterSidebar');
        const filterOverlay = document.getElementById('filterOverlay');
        if (filterSidebar) {
            filterSidebar.classList.remove('active');
            filterOverlay?.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Pagination click handler
    pagination?.addEventListener('click', async function (event) {
        const link = event.target.closest('a');
        if (link && !link.hasAttribute('disabled')) {
            event.preventDefault();
            await fetchAndUpdate(link.href);
            // Scroll to top after pagination change
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Filter products from search input
    async function filterProducts(event) {
        event.preventDefault();
        const form = event.target;
        const searchInput = form.querySelector('input[name="search"]')?.value.trim() || "";
        const url = buildUrl(1, { ...currentFilters, search: searchInput });
        await fetchAndUpdate(url);
    }

    // Build URL with filters
    function buildUrl(page, filters) {
        let url = `/shop?page=${page}&limit=${limit}`;
        if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
        if (filters.category) url += `&category=${encodeURIComponent(filters.category)}`;
        if (filters.author) url += `&author=${encodeURIComponent(filters.author)}`;
        if (filters.price) url += `&price=${encodeURIComponent(filters.price)}`;
        if (filters.sort) url += `&sort=${encodeURIComponent(filters.sort)}`;
        return url;
    }

    // Tracks the most recently triggered filter/sort/pagination request so an older, slower
    // request can never resolve after a newer one and clobber the UI with stale results (e.g.
    // clicking "All Categories" right after another filter). We deliberately do NOT use
    // AbortController to cancel the superseded request's underlying HTTP call — aborting it
    // client-side left the reused keep-alive connection stuck server-side, causing the NEXT
    // request queued on that same connection to hang forever. Instead we just let every
    // request run to completion and silently discard the result of any that's no longer latest.
    let latestRequestId = 0;

    // Fetch data and update UI
    async function fetchAndUpdate(url) {
        const requestId = ++latestRequestId;

        try {
            // Show loading indicator
            bookGrid.innerHTML = '<div class="col-span-full flex justify-center py-12"><i class="fas fa-spinner fa-spin fa-3x text-gray-400"></i></div>';

            const response = await fetch(url, {
                method: "GET",
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });

            if (requestId !== latestRequestId) return; // superseded by a newer request while this one was in flight

            if (!response.ok) {
                throw new Error('Server responded with an error');
            }

            const result = await response.json();

            if (requestId !== latestRequestId) return; // superseded while parsing the response

            if (result.success) {
                updateData(result.allProducts, result.wishlistItems || []);
                updatePagination(result.totalPages, result.page, result);
                updateCurrentFilters(result);

                // Update browser history
                history.pushState({}, '', url);

                // Update search inputs to match current search
                const searchInputs = document.querySelectorAll('input[name="search"]');
                searchInputs.forEach(input => {
                    input.value = result.search || '';
                });

                // Update body data attributes (server returns the sort value as "currentSort")
                Object.keys(currentFilters).forEach(key => {
                    const value = key === 'sort' ? result.currentSort : result[key];
                    body.setAttribute(`data-${key}`, (value && value !== 'default') ? value : '');
                });
            } else {
                bookGrid.innerHTML = `<div class="text-lg text-red-600 font-semibold text-center mt-2 col-span-full">${result.errorMessage || 'No products found.'}</div>`;
            }
        } catch (error) {
            if (requestId !== latestRequestId) return; // a newer request superseded this one — ignore its failure too
            console.error('Filter error:', error.message);
            bookGrid.innerHTML = '<div class="text-lg text-red-600 font-semibold text-center mt-2 col-span-full">Failed to load products. Please try again.</div>';
            showToast("Failed to filter products");
        }
    }

    // Update current filter values
    function updateCurrentFilters(result) {
        currentFilters.search = result.search || "";
        currentFilters.category = result.category || "";
        currentFilters.author = result.author || "";
        currentFilters.price = result.price || "";
        currentFilters.sort = result.currentSort === "default" ? "" : (result.currentSort || "");
        highlightActiveFilters();
    }

    // Highlight active filter links
    function highlightActiveFilters() {
        document.querySelectorAll('.filter-link').forEach(link => {
            const filterType = link.getAttribute('data-filter');
            const filterValue = link.getAttribute('data-value');

            let isActive = false;

            if (filterType) {
                const currentValue = currentFilters[filterType];
                if (filterValue === 'all' && !currentValue) {
                    isActive = true;
                } else if (currentValue && filterValue.trim().toLowerCase() === currentValue.trim().toLowerCase()) {
                    isActive = true;
                }
            }

            // Apply active styling
            link.classList.toggle('font-bold', isActive);
            link.classList.toggle('bg-gray-100', isActive);
        });
    }

    // Update product grid with data
    function updateData(products, wishlistItems = []) {
        if (!bookGrid) return;

        bookGrid.innerHTML = '';

        if (!products?.length) {
            bookGrid.innerHTML = `<div class="text-lg text-red-600 font-semibold text-center mt-2 col-span-full">No products found.</div>`;
            return;
        }

        products.forEach(product => {
            if (!product.isBlocked) {
                const isInWishlist = wishlistItems.some(item => (item._id || item).toString() === product._id.toString());
                const stars = Array(5).fill()
                    .map((_, i) => `<i class="${i < Math.floor(product.rating) ? 'fas' : 'far'} fa-star text-sm"></i>`)
                    .join('');

                // Create product card with responsive design
                bookGrid.innerHTML += `
                    <article class="bg-white rounded-lg shadow-md hover:shadow-xl overflow-hidden transition-transform hover:scale-105">
                        <div class="relative h-48 sm:h-56 md:h-64 bg-gray-50">
                            <a href="/product-details/${product._id}" class="flex justify-center h-full">
                                <img src="${product.images[0]}" alt="${product.name}" 
                                    class="w-auto h-full object-cover rounded-t-md">
                            </a>
                            <button onclick="addToWishlist(this, '${product._id}')" 
                                class="wishlist-btn absolute top-2 right-2 p-2 bg-white rounded-full shadow-sm hover:bg-gray-100"
                                data-product-id="${product._id}">
                                <i class="${isInWishlist ? 'fas text-red-500' : 'far text-gray-600'} fa-heart"></i>
                            </button>
                        </div>
                        <div class="p-4">
                            <h3 class="font-semibold text-base sm:text-lg truncate mb-1">
                                ${product.name}
                            </h3>
                            <p class="text-gray-600 text-sm mb-2 truncate">
                                ${product.authorName}
                            </p>
                            <div class="text-yellow-400 space-x-1 mb-2">
                                ${stars}
                            </div>
                            ${product.bestOffer ?
                        `<p class="text-sm font-semibold text-red-700 mb-2">${product.bestOffer}% offer</p>` :
                        ''}
                            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <span class="font-bold text-gray-900">Rs. ${product.price}</span>
                                <button 
                                    onclick="addToCart('${product._id}')" 
                                    id="addToCart"
                                    ${product.stock > 0 ? "" : "disabled"}
                                    class="${product.stock > 0 ?
                        'bg-black text-white px-3 py-1 sm:px-4 sm:py-2 text-sm rounded hover:bg-gray-800 transition w-full sm:w-auto text-center' :
                        'bg-gray-400 text-white px-3 py-1 sm:px-4 sm:py-2 text-sm rounded w-full sm:w-auto text-center'}"
                                    aria-label="Add ${product.name} to cart">
                                    ADD TO CART
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            }
        });
    }

    // Update pagination controls
    function updatePagination(totalPages, currentPage, result) {
        if (!pagination) return;

        pagination.innerHTML = '';

        if (totalPages <= 0) return; // no results: leave pagination empty instead of showing stale buttons
        const filters = {
            search: result.search || "",
            category: result.category || "",
            author: result.author || "",
            price: result.price || "",
            sort: result.currentSort === "default" ? "" : (result.currentSort || "")
        };

        // Previous page button
        pagination.innerHTML += `
            <a href="${currentPage > 1 ? buildUrl(currentPage - 1, filters) : '#'}" 
               class="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded border border-gray-300 ${currentPage > 1 ? 'hover:bg-gray-100' : 'text-gray-400 cursor-default'}" 
               ${currentPage > 1 ? '' : 'disabled'}>
                <i class="fas fa-chevron-left"></i>
            </a>
        `;

        // For better mobile pagination, show limited pages
        let startPage = Math.max(1, currentPage - 1);
        let endPage = Math.min(totalPages, currentPage + 1);

        // Ensure at least 3 page buttons when possible
        if (endPage - startPage < 2 && totalPages > 2) {
            if (startPage === 1) {
                endPage = Math.min(3, totalPages);
            } else {
                startPage = Math.max(1, endPage - 2);
            }
        }

        // Page number buttons
        for (let i = startPage; i <= endPage; i++) {
            pagination.innerHTML += `
                <a href="${buildUrl(i, filters)}" 
                   class="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded ${i === currentPage ? 'bg-black text-white' : 'border border-gray-300 hover:bg-gray-100'}">
                    ${i}
                </a>
            `;
        }

        // Next page button
        pagination.innerHTML += `
            <a href="${currentPage < totalPages ? buildUrl(currentPage + 1, filters) : '#'}" 
               class="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded border border-gray-300 ${currentPage < totalPages ? 'hover:bg-gray-100' : 'text-gray-400 cursor-default'}" 
               ${currentPage < totalPages ? '' : 'disabled'}>
                <i class="fas fa-chevron-right"></i>
            </a>
        `;
    }

    // Initialize mobile filter functionality
    function initMobileFilters() {
        const filterBtn = document.getElementById('filterBtn');
        const filterSidebar = document.getElementById('filterSidebar');
        const filterOverlay = document.getElementById('filterOverlay');
        const closeFilterBtn = document.getElementById('closeFilterBtn');

        if (filterBtn && filterSidebar) {
            filterBtn.addEventListener('click', () => {
                filterSidebar.classList.add('active');
                filterOverlay?.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        }

        if (closeFilterBtn && filterSidebar) {
            closeFilterBtn.addEventListener('click', () => {
                filterSidebar.classList.remove('active');
                filterOverlay?.classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        if (filterOverlay && filterSidebar) {
            filterOverlay.addEventListener('click', () => {
                filterSidebar.classList.remove('active');
                filterOverlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
    }
});
