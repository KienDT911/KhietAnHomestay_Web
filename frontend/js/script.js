// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const navHeight = document.querySelector('.navbar').offsetHeight;
            const targetPosition = target.offsetTop - navHeight;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Navbar background change on scroll
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

// window.addEventListener('scroll', () => {
//     const currentScroll = window.pageYOffset;
    
//     if (currentScroll > 100) {
//         navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.12)';
//         navbar.style.background = 'var(--sage-green)';
//     } else {
//         navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
//         navbar.style.background = 'var(--sage-green)';
//     }
    
//     lastScroll = currentScroll;
// });

// Add active class to navigation links based on scroll position
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

function highlightNavigation() {
    const scrollPosition = window.pageYOffset + 100;
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}

window.addEventListener('scroll', highlightNavigation);

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all cards and content sections
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.room-card, .feature-card, .contact-card');
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Form submission handler
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(contactForm);
        
        // Here you would typically send the data to your backend
        // For now, we'll just show a success message
        alert('Thank you for your message! We will get back to you soon. 🏡');
        contactForm.reset();
    });
}

// Book Now button handlers
const bookButtons = document.querySelectorAll('.btn-secondary');
bookButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const roomCard = e.target.closest('.room-card');
        const roomTitle = roomCard.querySelector('.room-title').textContent;
        const roomPrice = roomCard.querySelector('.room-price').textContent;
        
        alert(`Booking inquiry for: ${roomTitle}\nPrice: ${roomPrice}\n\nPlease scroll down to contact us or call us directly!`);
        
        // Smooth scroll to contact section
        document.querySelector('#contact').scrollIntoView({ behavior: 'smooth' });
    });
});

// Add loading animation for images (when you add real images)
window.addEventListener('load', () => {
    const imagePlaceholders = document.querySelectorAll('.room-image-placeholder');
    imagePlaceholders.forEach(placeholder => {
        placeholder.style.opacity = '1';
    });
});

// Add parallax effect to hero section
window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    const scrolled = window.pageYOffset;
    if (hero && scrolled < window.innerHeight) {
        // Move hero slightly upward to avoid overlapping next section
        const offset = Math.min(scrolled * 0.15, 60);
        hero.style.transform = `translateY(${-offset}px)`;
    }
});

// Mobile menu toggle (for future mobile navigation)
function createMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const navContainer = document.querySelector('.nav-container');
    
    // Only create mobile menu if screen is small
    if (window.innerWidth <= 768) {
        if (!document.querySelector('.mobile-menu-toggle')) {
            const menuToggle = document.createElement('button');
            menuToggle.className = 'mobile-menu-toggle';
            menuToggle.innerHTML = '☰';
            menuToggle.style.cssText = `
                display: block;
                background: none;
                border: none;
                font-size: 28px;
                color: var(--sage-green);
                cursor: pointer;
            `;
            
            navContainer.appendChild(menuToggle);
            
            menuToggle.addEventListener('click', () => {
                navMenu.classList.toggle('mobile-active');
                menuToggle.innerHTML = navMenu.classList.contains('mobile-active') ? '✕' : '☰';
            });
        }
    }
}

// Check for mobile menu on load and resize
window.addEventListener('load', createMobileMenu);
window.addEventListener('resize', createMobileMenu);

// Add a gentle pulse animation to "Book Now" buttons
setInterval(() => {
    bookButtons.forEach((btn, index) => {
        setTimeout(() => {
            btn.style.transform = 'scale(1.05)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
            }, 200);
        }, index * 100);
    });
}, 5000);

// Console welcome message
console.log('%c Welcome to Khiết An Homestay 🏡', 'color: #7B9B7E; font-size: 20px; font-weight: bold;');
console.log('%c Come as a guest. Leave as family. ❤️', 'color: #B8926A; font-size: 14px;');
