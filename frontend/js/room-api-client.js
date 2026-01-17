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

/**
 * Display rooms in the rooms section
 */
function displayRoomsFromAPI() {
    const roomsGrid = document.querySelector('.rooms-grid');
    if (!roomsGrid) return;

    const rooms = homepageRoomManager.getAllRooms();
    
    if (rooms.length === 0) {
        roomsGrid.innerHTML = '<div class="loading-rooms"><p>No rooms available at the moment.</p></div>';
        return;
    }

    roomsGrid.innerHTML = '';

    rooms.forEach(room => {
        const amenitiesHtml = room.amenities
            ? room.amenities.map(a => `<span class="amenity">• ${a}</span>`).join('')
            : '';

        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        roomCard.dataset.roomId = room.room_id;
        roomCard.innerHTML = `
            <div class="room-image-placeholder" onclick="openCalendarModal('${room.room_id}')" style="cursor: pointer;">
                <span class="placeholder-text">${room.name}</span>
            </div>
            <div class="room-content">
                <h3 class="room-title">${room.name}</h3>
                <p class="room-description">${room.description}</p>
                <div class="room-amenities">
                    ${amenitiesHtml}
                </div>
                <div class="room-footer">
                    <span class="room-price">${formatPrice(room.price)}/night</span>
                    <span class="room-capacity">👤 ${room.persons || room.capacity} guests</span>
                </div>
                <button class="btn-secondary view-calendar-btn" onclick="openCalendarModal('${room.room_id}')">
                    📅 View Calendar
                </button>
            </div>
        `;
        roomsGrid.appendChild(roomCard);
    });
    
    // Re-apply animations
    applyCardAnimations();
}

/**
 * Format price for display
 */
function formatPrice(price) {
    if (price >= 1000) {
        return `${price.toLocaleString()}k VND`;
    }
    return `$${price}`;
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
 * Change calendar month with smooth slide animation
 */
function changeMonth(delta) {
    const slider = document.getElementById('calendar-slider');
    
    // Prevent multiple clicks during animation
    if (slider.classList.contains('sliding-left') || slider.classList.contains('sliding-right')) {
        return;
    }
    
    // Update the calendar data first
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
    
    // Then apply the slide animation
    if (delta > 0) {
        slider.classList.add('sliding-left');
    } else {
        slider.classList.add('sliding-right');
    }
    
    // Remove animation class after it completes
    setTimeout(() => {
        slider.classList.remove('sliding-left', 'sliding-right');
    }, 500);
}

/**
 * Render dual calendar (left month and right month)
 */
function renderCalendar() {
    if (!currentRoomData) return;
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Left calendar - current month
    const leftYear = currentCalendarDate.getFullYear();
    const leftMonth = currentCalendarDate.getMonth();
    
    document.getElementById('calendar-month-left').textContent = `${monthNames[leftMonth]} ${leftYear}`;
    renderMonthDays('calendar-days-left', leftYear, leftMonth);
    
    // Right calendar - next month
    const rightDate = new Date(currentCalendarDate);
    rightDate.setMonth(rightDate.getMonth() + 1);
    const rightYear = rightDate.getFullYear();
    const rightMonth = rightDate.getMonth();
    
    document.getElementById('calendar-month-right').textContent = `${monthNames[rightMonth]} ${rightYear}`;
    renderMonthDays('calendar-days-right', rightYear, rightMonth);
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
