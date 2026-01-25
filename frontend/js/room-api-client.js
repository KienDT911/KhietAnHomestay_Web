/**
 * Homepage Room Management - Read-Only Access
 * Fetches room data from the public API with MongoDB/Fallback support
 */

// API URLs - Uses same origin since frontend is served by Flask
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:5000'
    : '';  // Empty string = same origin (both frontend and API served from Render)

const HOMEPAGE_API_URL = `${API_BASE_URL}/backend/api/rooms`;
const HEALTH_CHECK_URL = `${API_BASE_URL}/backend/health`;

class HomepageRoomManager {
    constructor() {
        this.rooms = [];
        this.initialized = false;
        this.dataSource = 'unknown';
        this.isConnected = false;
    }

    /**
     * Check backend health and data source
     */
    async checkHealth() {
        try {
            const response = await fetch(HEALTH_CHECK_URL);
            const result = await response.json();
            
            this.isConnected = result.status === 'healthy';
            this.dataSource = result.source || 'unknown';
            
            console.log(`🏥 Backend Status: ${result.status}`);
            console.log(`📊 Data Source: ${this.dataSource}`);
            
            return result;
        } catch (error) {
            console.error('❌ Health check failed:', error);
            this.isConnected = false;
            this.dataSource = 'offline';
            return null;
        }
    }

    /**
     * Load all rooms from the homepage API
     * Automatically handles MongoDB or fallback JSON data
     */
    async loadRooms() {
        try {
            const response = await fetch(HOMEPAGE_API_URL);
            const result = await response.json();
            
            if (result.success) {
                this.rooms = result.data || [];
                this.dataSource = result.source || 'unknown';
                this.initialized = true;
                
                const sourceIcon = result.source === 'mongodb' ? '🔗' : '📁';
                console.log(`${sourceIcon} Loaded ${this.rooms.length} rooms from ${result.source}`);
                
                // Dispatch event for UI updates
                window.dispatchEvent(new CustomEvent('roomsLoaded', { 
                    detail: { 
                        rooms: this.rooms, 
                        source: result.source,
                        count: result.count 
                    } 
                }));
                
                return this.rooms;
            } else {
                console.error('Failed to load rooms:', result.error);
                return [];
            }
        } catch (error) {
            console.error('❌ Error loading rooms:', error);
            // Try to load from localStorage as last resort
            return this.loadFromLocalStorage();
        }
    }

    /**
     * Fallback: Load rooms from localStorage if API fails
     */
    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('khietanRoomsCache');
            if (stored) {
                this.rooms = JSON.parse(stored);
                this.dataSource = 'localStorage';
                console.log(`💾 Loaded ${this.rooms.length} rooms from localStorage cache`);
                return this.rooms;
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }
        return [];
    }

    /**
     * Cache rooms to localStorage for offline fallback
     */
    cacheRooms() {
        try {
            localStorage.setItem('khietanRoomsCache', JSON.stringify(this.rooms));
            console.log('💾 Rooms cached to localStorage');
        } catch (e) {
            console.error('Failed to cache rooms:', e);
        }
    }

    /**
     * Get current data source
     */
    getDataSource() {
        return this.dataSource;
    }

    /**
     * Check if using live MongoDB data
     */
    isUsingLiveData() {
        return this.dataSource === 'mongodb';
    }

    /**
     * Get a single room by ID
     */
    async getRoomById(roomId) {
        try {
            const response = await fetch(`${HOMEPAGE_API_URL}/${roomId}`);
            const result = await response.json();
            
            if (result.success) {
                return result.data;
            } else {
                console.error('Failed to load room:', result.error);
                return null;
            }
        } catch (error) {
            console.error('Error loading room:', error);
            return null;
        }
    }

    /**
     * Get all rooms cached in memory
     */
    getAllRooms() {
        return this.rooms;
    }

}

// Initialize room manager
const homepageRoomManager = new HomepageRoomManager();

// Calendar state
let currentCalendarDate = new Date();
let currentRoomData = null;

// Load rooms when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🏠 KhietAn Homestay - Loading rooms...');
    
    // Check backend health first
    await homepageRoomManager.checkHealth();
    
    // Load rooms from API
    await homepageRoomManager.loadRooms();
    
    // Cache rooms for offline fallback
    homepageRoomManager.cacheRooms();
    
    // Display rooms dynamically
    displayRoomsFromAPI();
    
    console.log('✅ Rooms loaded successfully');
});

// Re-render rooms when language changes
window.addEventListener('languageChanged', function() {
    displayRoomsFromAPI();
});

/**
 * Display rooms in the rooms section
 */
function displayRoomsFromAPI() {
    const roomsGrid = document.querySelector('.rooms-grid');
    if (!roomsGrid) return;

    const rooms = homepageRoomManager.getAllRooms();
    const lang = window.i18n ? window.i18n.getCurrentLang() : 'en';
    
    // Get translations
    const viewCalendarText = window.i18n ? window.i18n.t('view_calendar') : '📅 View Calendar';
    const guestsText = window.i18n ? window.i18n.t('guests') : 'guests';
    const nightText = window.i18n ? window.i18n.t('night') : 'night';
    
    if (rooms.length === 0) {
        const loadingText = window.i18n ? window.i18n.t('loading_rooms') : 'No rooms available at the moment.';
        roomsGrid.innerHTML = `<div class="loading-rooms"><p>${loadingText}</p></div>`;
        return;
    }

    roomsGrid.innerHTML = '';

    rooms.forEach(room => {
        // Debug: log promotion data
        console.log(`Room ${room.name}: promotion =`, room.promotion);
        
        const amenitiesHtml = room.amenities
            ? room.amenities.map(a => `<span class="amenity">• ${a}</span>`).join('')
            : '';

        // Use Vietnamese description if available and current lang is Vietnamese
        const description = (lang === 'vi' && room.description_vi) ? room.description_vi : room.description;
        const name = (lang === 'vi' && room.name_vi) ? room.name_vi : room.name;

        // Get cover image URL from Cloudinary
        const coverImageUrl = room.coverImage;
        const hasImage = !!coverImageUrl;
        
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        roomCard.dataset.roomId = room.room_id;
        roomCard.innerHTML = `
            <div class="room-image${hasImage ? '' : ' no-image'}" onclick="openRoomGallery('${room.room_id}')" style="cursor: pointer;">
                ${hasImage 
                    ? `<img src="${coverImageUrl}" alt="${name}" class="room-cover-image" onerror="this.parentElement.classList.add('no-image'); this.style.display='none';">`
                    : `<span class="placeholder-text">${name}</span>`
                }
            </div>
            <div class="room-content">
                <h3 class="room-title">${name}</h3>
                <p class="room-description">${description}</p>
                <div class="room-amenities">
                    ${amenitiesHtml}
                </div>
                <div class="room-footer">
                    <div class="price-container">
                        ${room.promotion && room.promotion.active 
                            ? `<span class="room-price-original">${formatPrice(room.price)}</span>
                               <span class="room-price-discount">${formatPrice(room.promotion.discountPrice)}</span>`
                            : `<span class="room-price">${formatPrice(room.price)}</span>`
                        }
                    </div>
                    <span class="room-capacity">👤 ${room.persons || room.capacity} ${guestsText}</span>
                </div>
                <button class="btn-secondary view-calendar-btn" onclick="openCalendarModal('${room.room_id}')">
                    ${viewCalendarText}
                </button>
            </div>
        `;
        roomsGrid.appendChild(roomCard);
    });
    
    // Re-apply animations
    applyCardAnimations();
}

/**
 * Format price for display in Vietnamese VND format
 * e.g., 700 -> "700.000 VND"
 */
function formatPrice(price) {
    // Format as VND with thousands separator as period
    const vndPrice = Math.round(price * 1000);
    return `${vndPrice.toLocaleString('de-DE')} VND`;
}

/**
 * Apply fade-in animations to room cards
 */
function applyCardAnimations() {
    const cards = document.querySelectorAll('.room-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.15 });
    
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
}

// ===== Calendar Modal Functions =====

/**
 * Open calendar modal for a specific room
 */
/**
 * Open room gallery modal to display all images
 * Layout: Main image on left, scrollable thumbnails on right with section labels
 */
function openRoomGallery(roomId) {
    const room = homepageRoomManager.getAllRooms().find(r => r.room_id === roomId);
    if (!room) {
        console.error('Room not found:', roomId);
        return;
    }
    
    // Get all images - combine cover and categorized/gallery images
    const coverImage = room.coverImage || null;
    const categorizedImages = room.categorizedImages || {};
    const galleryImages = room.galleryImages || [];
    
    // Get images by category
    const bedroomImages = categorizedImages.bedroom || [];
    const bathroomImages = categorizedImages.bathroom || [];
    const exteriorImages = categorizedImages.exterior || [];
    
    // Get translations for section headers
    const lang = window.i18n ? window.i18n.getCurrentLang() : 'en';
    const sectionLabels = {
        cover: lang === 'vi' ? 'Ảnh bìa' : 'Cover',
        bedroom: lang === 'vi' ? 'Phòng ngủ' : 'Bedroom',
        bathroom: lang === 'vi' ? 'Phòng tắm' : 'Bathroom',
        exterior: lang === 'vi' ? 'Ngoại cảnh' : 'Exterior',
        room: lang === 'vi' ? 'Hình ảnh' : 'Images'
    };
    
    // If no images at all, show a message
    const hasImages = coverImage || bedroomImages.length > 0 || bathroomImages.length > 0 || exteriorImages.length > 0 || galleryImages.length > 0;
    if (!hasImages) {
        alert('No images available for this room.');
        return;
    }
    
    // Use first available image as main image
    const mainImage = coverImage || bedroomImages[0] || bathroomImages[0] || exteriorImages[0] || galleryImages[0];
    
    // Build thumbnails HTML with section labels
    let thumbnailsHTML = '';
    let imageIndex = 0;
    
    // Helper function to create thumbnail items for a category
    const createThumbnailSection = (images, categoryKey) => {
        if (!images || images.length === 0) return '';
        
        let sectionHTML = `<div class="thumbnail-section-label">${sectionLabels[categoryKey]}</div>`;
        images.forEach((imgUrl) => {
            const isActive = imgUrl === mainImage ? ' active' : '';
            sectionHTML += `
                <div class="thumbnail-item${isActive}" onclick="changeGalleryImage(this, '${imgUrl}')" data-index="${imageIndex}">
                    <img src="${imgUrl}" alt="${room.name} - ${sectionLabels[categoryKey]}" loading="lazy" onerror="this.parentElement.style.display='none'">
                </div>
            `;
            imageIndex++;
        });
        return sectionHTML;
    };
    
    // Add cover section
    if (coverImage) {
        thumbnailsHTML += createThumbnailSection([coverImage], 'cover');
    }
    
    // Add categorized sections
    thumbnailsHTML += createThumbnailSection(bedroomImages, 'bedroom');
    thumbnailsHTML += createThumbnailSection(bathroomImages, 'bathroom');
    thumbnailsHTML += createThumbnailSection(exteriorImages, 'exterior');
    
    // Fallback to gallery images if no categorized images
    if (!coverImage && bedroomImages.length === 0 && bathroomImages.length === 0 && exteriorImages.length === 0) {
        thumbnailsHTML += createThumbnailSection(galleryImages, 'room');
    }
    
    // Create gallery modal HTML with main image + thumbnails layout
    const modalHTML = `
        <div class="gallery-modal" onclick="closeRoomGallery(event)">
            <div class="gallery-container" onclick="event.stopPropagation()">
                <button class="gallery-close" onclick="closeRoomGallery()">&times;</button>
                <h2 class="gallery-title">${room.name}</h2>
                <div class="gallery-grid">
                    <div class="gallery-image-main" onclick="openFullscreenImage(document.getElementById('gallery-main-image').src, '${room.name}')">
                        <img id="gallery-main-image" src="${mainImage}" alt="${room.name}">
                    </div>
                    <div class="gallery-thumbnails">
                        ${thumbnailsHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Check if modal already exists, if so remove it
    const existingModal = document.querySelector('.gallery-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create and append modal
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal.firstElementChild);
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
}

/**
 * Open fullscreen image viewer
 */
function openFullscreenImage(imageSrc, imageAlt) {
    const fullscreenHTML = `
        <div class="fullscreen-viewer" onclick="closeFullscreenImage(event)">
            <button class="fullscreen-close" onclick="closeFullscreenImage()">&times;</button>
            <img src="${imageSrc}" alt="${imageAlt}" onclick="event.stopPropagation()">
        </div>
    `;
    
    // Remove existing fullscreen viewer if any
    const existing = document.querySelector('.fullscreen-viewer');
    if (existing) existing.remove();
    
    const viewer = document.createElement('div');
    viewer.innerHTML = fullscreenHTML;
    document.body.appendChild(viewer.firstElementChild);
}

/**
 * Close fullscreen image viewer
 */
function closeFullscreenImage(event) {
    if (!event || event.target.classList.contains('fullscreen-viewer')) {
        const viewer = document.querySelector('.fullscreen-viewer');
        if (viewer) viewer.remove();
    }
}

/**
 * Close room gallery modal
 */
function closeRoomGallery(event) {
    // Close on background click or close button
    if (!event || event.target.classList.contains('gallery-modal')) {
        const modal = document.querySelector('.gallery-modal');
        if (modal) {
            modal.remove();
        }
        // Restore body scroll
        document.body.style.overflow = 'auto';
    }
}

/**
 * Change gallery main image (legacy support)
 */
function changeGalleryImage(element, imageSrc) {
    const mainImage = document.getElementById('gallery-main-image');
    if (mainImage) {
        mainImage.src = imageSrc;
    }
    document.querySelectorAll('.thumbnail-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');
}

function openCalendarModal(roomId) {
    const room = homepageRoomManager.getAllRooms().find(r => r.room_id === roomId);
    if (!room) {
        console.error('Room not found:', roomId);
        return;
    }
    
    currentRoomData = room;
    currentCalendarDate = new Date();
    
    // Update modal header
    document.getElementById('modal-room-name').textContent = `${room.name} - Calendar`;
    document.getElementById('modal-room-price').textContent = `${formatPrice(room.price)}/night • ${room.persons || room.capacity} guests`;
    
    // Render calendar
    renderCalendar();
    
    // Show modal
    document.getElementById('room-calendar-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Close calendar modal
 */
function closeCalendarModal() {
    document.getElementById('room-calendar-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('booking-details').style.display = 'none';
}

/**
 * Change calendar month with smooth carousel animation
 */
function changeMonth(delta) {
    const slider = document.getElementById('calendar-slider');
    
    // Prevent multiple clicks during animation
    if (slider.hasAttribute('data-animating')) {
        return;
    }
    
    slider.setAttribute('data-animating', 'true');
    
    // Check if mobile view (vertical slider)
    const isMobile = window.innerWidth <= 480;
    
    // Ensure transition is enabled
    slider.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)';
    
    if (isMobile) {
        // Vertical sliding for mobile using fixed pixel values
        // Each month is 190px, starting at -190px (showing months 1 and 2)
        if (delta > 0) {
            // NEXT: slide up from -190px to -380px
            slider.style.transform = 'translateY(-380px)';
        } else {
            // PREV: slide down from -190px to 0px
            slider.style.transform = 'translateY(0px)';
        }
    } else {
        // Horizontal sliding for desktop
        if (delta > 0) {
            // NEXT: slide left from -25% to -50%
            slider.style.transform = 'translateX(-50%)';
        } else {
            // PREV: slide right from -25% to 0%
            slider.style.transform = 'translateX(0%)';
        }
    }
    
    // Listen for transition end instead of using setTimeout
    const onTransitionEnd = () => {
        slider.removeEventListener('transitionend', onTransitionEnd);
        
        // Update the calendar date
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
        
        // Disable transition before resetting position
        slider.style.transition = 'none';
        
        // Render new months
        renderCarousel();
        
        // Reset transform back to centered position
        if (isMobile) {
            slider.style.transform = 'translateY(-190px)';
        } else {
            slider.style.transform = 'translateX(-25%)';
        }        
        // Force reflow to apply the transform immediately
        slider.offsetHeight;
        
        // Re-enable transition for next animation
        slider.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)';
        slider.removeAttribute('data-animating');
    };
    
    slider.addEventListener('transitionend', onTransitionEnd);
}

/**
 * Render 4-month carousel (prev-prev, left, right, next-next)
 * Initial position shows months at index 1 and 2 (left and right panels)
 * Carousel layout at -50%: [month-1] [month] [month+1] [month+2]
 *                           ^^hidden  visible visible  hidden^^
 */
function renderCarousel() {
    if (!currentRoomData) return;
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Calculate 4 consecutive months starting from current month - 1
    // This ensures:
    // Index 0: month-1 (off-screen left at -50%)
    // Index 1: month (visible left at -50%)
    // Index 2: month+1 (visible right at -50%)
    // Index 3: month+2 (off-screen right at -50%)
    const months = [];
    for (let i = -1; i <= 2; i++) {
        const date = new Date(currentCalendarDate);
        date.setMonth(date.getMonth() + i);
        months.push({
            year: date.getFullYear(),
            month: date.getMonth(),
            name: `${monthNames[date.getMonth()]} ${date.getFullYear()}`
        });
    }
    
    // Render each month in carousel positions
    const monthIds = ['prev-prev', 'left', 'right', 'next-next'];
    const dayIds = ['calendar-days-prev-prev', 'calendar-days-left', 'calendar-days-right', 'calendar-days-next-next'];
    
    months.forEach((monthData, index) => {
        const monthTitle = document.getElementById(`calendar-month-${monthIds[index]}`);
        if (monthTitle) {
            monthTitle.textContent = monthData.name;
        }
        renderMonthDays(dayIds[index], monthData.year, monthData.month);
    });
}

/**
 * Render dual calendar (left month and right month)
 */
function renderCalendar() {
    renderCarousel();
}

/**
 * Render days for a specific month into a container
 */
function renderMonthDays(containerId, year, month) {
    // Get first day and number of days in month
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Get booked dates
    const bookedDates = getBookedDatesForMonth(year, month);
    
    // Build calendar HTML
    const calendarDays = document.getElementById(containerId);
    let html = '';
    
    // Add empty cells for days before first day of month
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    // Add days
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const booking = bookedDates[dateStr];
        
        let classes = 'calendar-day';
        let title = '';
        
        // Check if date is in the past
        if (dateStr < todayStr) {
            classes += ' past';
        } else if (dateStr === todayStr) {
            classes += ' today';
        }
        
        if (booking) {
            classes += ' booked';
            title = 'Booked';
        } else if (dateStr >= todayStr) {
            classes += ' available';
        }
        
        html += `<div class="${classes}" data-date="${dateStr}" title="${title}">${day}</div>`;
    }
    
    calendarDays.innerHTML = html;
}

/**
 * Get booked dates for a specific month
 */
function getBookedDatesForMonth(year, month) {
    const bookedDates = {};
    
    if (!currentRoomData || !currentRoomData.bookedIntervals) {
        return bookedDates;
    }
    
    currentRoomData.bookedIntervals.forEach(interval => {
        const checkIn = new Date(interval.checkIn);
        const checkOut = new Date(interval.checkOut);
        
        // Iterate through all dates in the interval
        let currentDate = new Date(checkIn);
        while (currentDate < checkOut) {
            if (currentDate.getFullYear() === year && currentDate.getMonth() === month) {
                const dateStr = currentDate.toISOString().split('T')[0];
                bookedDates[dateStr] = interval;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    return bookedDates;
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('room-calendar-modal');
    if (e.target === modal) {
        closeCalendarModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        // Close fullscreen viewer first if open
        const fullscreenViewer = document.querySelector('.fullscreen-viewer');
        if (fullscreenViewer) {
            fullscreenViewer.remove();
            return;
        }
        
        // Then close gallery modal if open
        const galleryModal = document.querySelector('.gallery-modal');
        if (galleryModal) {
            galleryModal.remove();
            document.body.style.overflow = 'auto';
            return;
        }
        
        // Finally close calendar modal
        closeCalendarModal();
    }
});

// Add touch swipe support for mobile calendar navigation
let touchStartX = 0;
let touchEndX = 0;

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swiped left - go to next month
            changeMonth(1);
        } else {
            // Swiped right - go to previous month
            changeMonth(-1);
        }
    }
}

// Attach swipe listeners to calendar slider
window.addEventListener('DOMContentLoaded', function() {
    const slider = document.getElementById('calendar-slider');
    if (slider) {
        slider.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        slider.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
    }
});

/**
 * Example: Get room details for display
 */
function getRoomDetails(roomId) {
    const room = homepageRoomManager.getAllRooms().find(r => r.room_id === roomId);
    return room ? {
        name: room.name,
        price: room.price,
        capacity: room.capacity,
        amenities: room.amenities
    } : null;
}
