/**
 * Lazy Loading Utility
 * Improves page performance by loading images only when they're about to enter viewport
 */

class LazyLoader {
    constructor(options = {}) {
        this.options = {
            rootMargin: options.rootMargin || '50px',
            threshold: options.threshold || 0.01,
            className: options.className || 'lazy',
            loadedClassName: options.loadedClassName || 'lazy-loaded',
            errorClassName: options.errorClassName || 'lazy-error',
            placeholder: options.placeholder || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f0f0f0"/%3E%3C/svg%3E'
        };

        this.observer = null;
        this.images = [];
        this.init();
    }

    init() {
        // Check for IntersectionObserver support
        if (!('IntersectionObserver' in window)) {
            console.warn('IntersectionObserver not supported, loading all images immediately');
            this.loadAllImages();
            return;
        }

        // Create IntersectionObserver
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                rootMargin: this.options.rootMargin,
                threshold: this.options.threshold
            }
        );

        // Find and observe all lazy images
        this.findAndObserve();
    }

    findAndObserve() {
        // Find all images with lazy class
        this.images = document.querySelectorAll(`img.${this.options.className}`);
        
        this.images.forEach(img => {
            // Set placeholder if not already set
            if (!img.src || img.src === window.location.href) {
                img.src = this.options.placeholder;
            }

            // Observe the image
            this.observer.observe(img);
        });

        console.log(`LazyLoader: Observing ${this.images.length} images`);
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                this.loadImage(img);
                this.observer.unobserve(img);
            }
        });
    }

    loadImage(img) {
        const src = img.dataset.src;
        const srcset = img.dataset.srcset;

        if (!src) {
            console.warn('LazyLoader: No data-src attribute found', img);
            return;
        }

        // Create a new image to preload
        const tempImg = new Image();

        tempImg.onload = () => {
            // Set the actual src
            img.src = src;
            if (srcset) {
                img.srcset = srcset;
            }

            // Add loaded class
            img.classList.add(this.options.loadedClassName);
            img.classList.remove(this.options.className);

            // Dispatch custom event
            img.dispatchEvent(new CustomEvent('lazyloaded', {
                detail: { src }
            }));
        };

        tempImg.onerror = () => {
            console.error('LazyLoader: Failed to load image', src);
            img.classList.add(this.options.errorClassName);
            
            // Dispatch error event
            img.dispatchEvent(new CustomEvent('lazyerror', {
                detail: { src }
            }));
        };

        // Start loading
        tempImg.src = src;
        if (srcset) {
            tempImg.srcset = srcset;
        }
    }

    loadAllImages() {
        // Fallback: Load all images immediately (for browsers without IntersectionObserver)
        const images = document.querySelectorAll(`img.${this.options.className}`);
        images.forEach(img => this.loadImage(img));
    }

    // Add new images to observer (useful for dynamically added content)
    observe(elements) {
        if (!this.observer) return;

        const images = typeof elements === 'string' 
            ? document.querySelectorAll(elements)
            : elements;

        if (images.length) {
            images.forEach(img => {
                if (img.classList.contains(this.options.className)) {
                    this.observer.observe(img);
                }
            });
        }
    }

    // Unobserve element
    unobserve(element) {
        if (this.observer && element) {
            this.observer.unobserve(element);
        }
    }

    // Disconnect observer
    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
            console.log('LazyLoader: Observer disconnected');
        }
    }

    // Reload/refresh - find new images
    refresh() {
        this.findAndObserve();
    }
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.lazyLoader = new LazyLoader();
    });
} else {
    window.lazyLoader = new LazyLoader();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LazyLoader;
}


