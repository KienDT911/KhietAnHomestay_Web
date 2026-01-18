/**
 * Internationalization (i18n) for Khiết An Homestay
 * Supports English and Vietnamese
 */

const translations = {
    en: {
        // Navigation
        nav_home: "Home",
        nav_about: "About",
        nav_rooms: "Rooms",
        nav_contact: "Contact",
        
        // Hero
        hero_subtitle: "Your Peaceful Retreat. Your Home Away From Home.",
        hero_cta: "Explore Our Rooms",
        
        // About
        about_title: "Welcome to Khiết An",
        about_intro: 'Nestled in a serene neighborhood, <span class="birthstone-text">Khiết An</span> Homestay offers more than just accommodation—we provide a warm embrace of genuine hospitality and comfort.',
        
        // Features
        feature_cozy_title: "Cozy Atmosphere",
        feature_cozy_desc: "Every corner designed for your comfort and relaxation",
        feature_nature_title: "Natural Setting",
        feature_nature_desc: "Surrounded by peaceful greenery and fresh air",
        feature_hospitality_title: "Warm Hospitality",
        feature_hospitality_desc: "Treated like family from the moment you arrive",
        feature_comfort_title: "Homely Comforts",
        feature_comfort_desc: "All amenities you need for a comfortable stay",
        
        // Rooms
        rooms_title: "Our Rooms",
        rooms_subtitle: "Choose your perfect sanctuary",
        loading_rooms: "Loading rooms...",
        view_calendar: "View Calendar",
        guests: "guests",
        night: "night",
        
        // Calendar
        available: "Available",
        today: "Today",
        booked: "Booked",
        
        // Contact
        contact_title: "Get In Touch",
        contact_subtitle: "We'd love to host you!",
        address: "Address",
        address_text: "3/63 Le Huan Street<br>Thuan Hoa Ward, Hue City<br>Thua Thien Hue, Vietnam",
        phone: "Phone",
        phone_note: "Available 24/7",
        email_note: "We reply within 24 hours",
        checkin_checkout: "Check-in/Check-out",
        checkin_times: "Check-in: 2:00 PM<br>Check-out: 12:00 PM",
        find_us: "Find Us",
        
        // Footer
        footer_tagline: "Come as a guest. Leave as family.",
        follow_us: "Follow Us",
        copyright: "© 2025 Khiết An Homestay. All rights reserved."
    },
    vi: {
        // Navigation
        nav_home: "Trang chủ",
        nav_about: "Giới thiệu",
        nav_rooms: "Phòng",
        nav_contact: "Liên hệ",
        
        // Hero
        hero_subtitle: "Nơi nghỉ dưỡng yên bình. Ngôi nhà thứ hai của bạn.",
        hero_cta: "Khám phá phòng",
        
        // About
        about_title: "Xin kính chào quý khách",
        about_intro: 'Nằm trong một khu phố yên tĩnh, <span class="birthstone-text">Khiết An</span> Homestay không chỉ là nơi lưu trú, chúng tôi mang đến sự ấm áp của lòng hiếu khách, sự an lành và thuận tiện.',
        
        // Features
        feature_cozy_title: "Không gian ấm cúng",
        feature_cozy_desc: "Mọi góc nhỏ đều được thiết kế cho sự thoải mái của bạn",
        feature_nature_title: "Thiên nhiên xanh mát",
        feature_nature_desc: "Bao quanh bởi cây xanh và không khí trong lành",
        feature_hospitality_title: "Hiếu khách nhiệt tình",
        feature_hospitality_desc: "Được đối xử như người thân từ khi bạn đến",
        feature_comfort_title: "Tiện nghi đầy đủ",
        feature_comfort_desc: "Tất cả tiện nghi bạn cần cho một kỳ nghỉ thoải mái",
        
        // Rooms
        rooms_title: "Các phòng",
        rooms_subtitle: "Chọn không gian hoàn hảo cho bạn và gia đình",
        loading_rooms: "Đang tải phòng...",
        view_calendar: "Xem lịch",
        guests: "khách",
        night: "đêm",
        
        // Calendar
        available: "Còn trống",
        today: "Hôm nay",
        booked: "Đã đặt",
        
        // Contact
        contact_title: "Liên hệ",
        contact_subtitle: "Chúng tôi rất vui được đón tiếp bạn!",
        address: "Địa chỉ",
        address_text: "3/63 Lê Huân<br>Phường Thuận Hoà, TP. Huế<br>Thừa Thiên Huế, Việt Nam",
        phone: "Điện thoại",
        phone_note: "Liên lạc 24/7",
        email_note: "Phản hồi trong 24 giờ",
        checkin_checkout: "Nhận/Trả phòng",
        checkin_times: "Nhận phòng: 14:00<br>Trả phòng: 12:00",
        find_us: "Tìm chúng tôi",
        
        // Footer
        footer_tagline: "Đến như khách. Đi như người nhà.",
        follow_us: "Theo dõi",
        copyright: "© 2025 Khiết An Homestay. Bảo lưu mọi quyền."
    }
};

// Current language
let currentLang = localStorage.getItem('khietan_lang') || 'en';

/**
 * Get translation for a key
 */
function t(key) {
    return translations[currentLang][key] || translations['en'][key] || key;
}

/**
 * Apply translations to all elements with data-i18n attribute
 */
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);
        if (translation) {
            element.innerHTML = translation;
        }
    });
    
    // Update HTML lang attribute
    document.documentElement.lang = currentLang;
    
    // Update active button state
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
}

/**
 * Switch language
 */
function switchLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('khietan_lang', lang);
        
        // Update HTML lang attribute for CSS font switching
        document.documentElement.lang = lang;
        
        applyTranslations();
        
        // Dispatch event for dynamic content
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }
}

/**
 * Get current language
 */
function getCurrentLang() {
    return currentLang;
}

// Initialize language switcher on DOM load
document.addEventListener('DOMContentLoaded', function() {
    // Apply saved language
    applyTranslations();
    
    // Add click handlers to language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchLanguage(btn.dataset.lang);
        });
    });
});

// Export for use in other scripts
window.i18n = {
    t,
    switchLanguage,
    getCurrentLang,
    applyTranslations
};
