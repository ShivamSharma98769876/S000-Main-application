// ==================== MOBILE MENU TOGGLE ====================
const navMenu = document.getElementById('nav-menu');
const navToggle = document.getElementById('nav-toggle');
const navClose = document.getElementById('nav-close');
const navLinks = document.querySelectorAll('.nav__link');

// Show menu
if (navToggle) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.add('show');
    });
}

// Hide menu
if (navClose) {
    navClose.addEventListener('click', () => {
        navMenu.classList.remove('show');
    });
}

// Hide menu when clicking nav links
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('show');
    });
});

// ==================== HEADER SCROLL EFFECT ====================
const header = document.getElementById('header');

function scrollHeader() {
    if (window.scrollY >= 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
}

window.addEventListener('scroll', scrollHeader);

// ==================== ACTIVE LINK ON SCROLL ====================
const sections = document.querySelectorAll('section[id]');

function scrollActive() {
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav__link[href="#${sectionId}"]`);

        if (navLink) {
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLink.classList.add('active');
            } else {
                navLink.classList.remove('active');
            }
        }
    });
}

window.addEventListener('scroll', scrollActive);

// ==================== SCROLL TO TOP ====================
const scrollTop = document.getElementById('scroll-top');

function showScrollTop() {
    if (window.scrollY >= 400) {
        scrollTop.classList.add('show');
    } else {
        scrollTop.classList.remove('show');
    }
}

window.addEventListener('scroll', showScrollTop);

if (scrollTop) {
    scrollTop.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ==================== SMOOTH SCROLLING ====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        
        // Only prevent default for internal links (not just "#")
        if (href !== '#' && href.startsWith('#')) {
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const headerHeight = header.offsetHeight;
                const targetPosition = target.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// ==================== INTERSECTION OBSERVER FOR ANIMATIONS ====================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const fadeInObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Add fade-in animation to cards
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.product-card, .offer-card, .testimonial-card');
    
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
        fadeInObserver.observe(card);
    });
});

// ==================== PERFORMANCE: LAZY LOADING ====================
if ('loading' in HTMLImageElement.prototype) {
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
        img.src = img.dataset.src;
    });
} else {
    // Fallback for browsers that don't support lazy loading
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
    document.body.appendChild(script);
}

// ==================== PREVENT FOUC (Flash of Unstyled Content) ====================
document.documentElement.classList.add('js-loaded');

// ==================== ANALYTICS TRACKING (Placeholder) ====================
function trackEvent(eventName, eventData) {
    // This is a placeholder for analytics tracking
    // Replace with your analytics provider (GA4, Mixpanel, etc.)
    console.log('Event tracked:', eventName, eventData);
}

// Track CTA clicks
document.querySelectorAll('.btn--primary').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const btnText = e.target.textContent.trim();
        trackEvent('CTA Click', { button: btnText, url: e.target.href });
    });
});

// Track product card clicks
document.querySelectorAll('.product-card').forEach((card, index) => {
    card.addEventListener('click', () => {
        const productName = card.querySelector('.product-card__title').textContent;
        trackEvent('Product Card Click', { product: productName, position: index + 1 });
    });
});

// ==================== PERFORMANCE MONITORING ====================
if ('PerformanceObserver' in window) {
    // Monitor Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
    });
    
    try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
        console.warn('LCP observer not supported');
    }
    
    // Monitor First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
            console.log('FID:', entry.processingStart - entry.startTime);
        });
    });
    
    try {
        fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
        console.warn('FID observer not supported');
    }
}

// ==================== PAGE LOAD PERFORMANCE ====================
window.addEventListener('load', () => {
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    console.log('Page Load Time:', loadTime + 'ms');
    
    // Track if load time exceeds 3 seconds (requirement)
    if (loadTime > 3000) {
        console.warn('Page load time exceeds 3 second target:', loadTime + 'ms');
    }
});

// ==================== PRELOAD CRITICAL RESOURCES ====================
function preloadResource(href, as, type) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    if (type) link.type = type;
    document.head.appendChild(link);
}

// Preload fonts (if using local fonts)
// preloadResource('/fonts/inter.woff2', 'font', 'font/woff2');

// ==================== ERROR HANDLING ====================
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    // Send to error tracking service (Sentry, etc.)
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    // Send to error tracking service
});

// ==================== FEATURE DETECTION ====================
const features = {
    intersectionObserver: 'IntersectionObserver' in window,
    performanceObserver: 'PerformanceObserver' in window,
    webp: false,
    avif: false
};

// Check WebP support
function checkWebPSupport() {
    const elem = document.createElement('canvas');
    if (elem.getContext && elem.getContext('2d')) {
        return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
}

features.webp = checkWebPSupport();

// Log feature support
console.log('Browser features:', features);

// ==================== ACCESSIBILITY IMPROVEMENTS ====================
// Skip to main content
const skipLink = document.createElement('a');
skipLink.href = '#main';
skipLink.className = 'skip-link';
skipLink.textContent = 'Skip to main content';
skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--primary-color);
    color: white;
    padding: 8px 16px;
    text-decoration: none;
    z-index: 10000;
    transition: top 0.2s;
`;
skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
});
skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
});
document.body.insertBefore(skipLink, document.body.firstChild);

// Add aria-current to active nav link
function updateAriaCurrent() {
    navLinks.forEach(link => {
        if (link.classList.contains('active')) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
}

window.addEventListener('scroll', updateAriaCurrent);

// ==================== RESPONSIVE IMAGES ====================
function updateResponsiveImages() {
    const images = document.querySelectorAll('img[data-src-mobile], img[data-src-tablet]');
    const width = window.innerWidth;
    
    images.forEach(img => {
        if (width < 768 && img.dataset.srcMobile) {
            img.src = img.dataset.srcMobile;
        } else if (width < 1024 && img.dataset.srcTablet) {
            img.src = img.dataset.srcTablet;
        } else if (img.dataset.src) {
            img.src = img.dataset.src;
        }
    });
}

// Update on load and resize
window.addEventListener('load', updateResponsiveImages);
window.addEventListener('resize', debounce(updateResponsiveImages, 250));

// ==================== UTILITY FUNCTIONS ====================
// Debounce function for performance
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

// Throttle function for scroll events
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ==================== CONSOLE BRANDING ====================
console.log(
    '%c🚀 StockSage ',
    'background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 8px 16px; font-size: 16px; font-weight: bold; border-radius: 4px;'
);
console.log(
    '%cWelcome to StockSage! Looking for a career? Check out https://traStockSage.trade/careers',
    'color: #3b82f6; font-size: 14px;'
);

