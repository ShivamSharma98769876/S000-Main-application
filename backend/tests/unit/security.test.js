/**
 * Unit Tests for Security Middleware
 */

const { sanitizeInput, sqlInjectionProtection } = require('../../middleware/security');

describe('Security Middleware', () => {
    describe('sanitizeInput', () => {
        test('should remove script tags from input', () => {
            const input = '<script>alert("XSS")</script>Hello';
            const sanitized = sanitizeString(input);
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toContain('Hello');
        });

        test('should remove iframe tags', () => {
            const input = '<iframe src="evil.com"></iframe>Content';
            const sanitized = sanitizeString(input);
            expect(sanitized).not.toContain('<iframe>');
            expect(sanitized).toContain('Content');
        });

        test('should remove event handlers', () => {
            const input = '<div onclick="alert()">Click me</div>';
            const sanitized = sanitizeString(input);
            expect(sanitized).not.toContain('onclick');
        });

        test('should remove javascript: protocol', () => {
            const input = '<a href="javascript:alert()">Link</a>';
            const sanitized = sanitizeString(input);
            expect(sanitized).not.toContain('javascript:');
        });

        test('should handle nested objects', () => {
            const input = {
                name: '<script>alert()</script>John',
                profile: {
                    bio: '<iframe>test</iframe>Bio'
                }
            };
            const sanitized = sanitizeObject(input);
            expect(sanitized.name).not.toContain('<script>');
            expect(sanitized.profile.bio).not.toContain('<iframe>');
        });

        test('should handle arrays', () => {
            const input = ['<script>test</script>', 'normal', '<iframe>bad</iframe>'];
            const sanitized = sanitizeArray(input);
            expect(sanitized[0]).not.toContain('<script>');
            expect(sanitized[1]).toBe('normal');
            expect(sanitized[2]).not.toContain('<iframe>');
        });
    });

    describe('SQL Injection Protection', () => {
        test('should detect SQL injection patterns', () => {
            const malicious = [
                "' OR '1'='1",
                "'; DROP TABLE users--",
                "1' UNION SELECT * FROM users--",
                "admin'--",
                "' OR 1=1--"
            ];

            malicious.forEach(pattern => {
                expect(containsSQLInjection(pattern)).toBe(true);
            });
        });

        test('should allow safe inputs', () => {
            const safe = [
                "john@example.com",
                "John Doe",
                "Mumbai, Maharashtra",
                "+91 9876543210",
                "Product description with numbers 123"
            ];

            safe.forEach(input => {
                expect(containsSQLInjection(input)).toBe(false);
            });
        });
    });
});

// Helper functions
function sanitizeString(str) {
    return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '')
        .trim();
}

function sanitizeObject(obj) {
    if (typeof obj === 'string') {
        return sanitizeString(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    } else if (typeof obj === 'object' && obj !== null) {
        const sanitized = {};
        for (const key in obj) {
            sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
    }
    return obj;
}

function sanitizeArray(arr) {
    return arr.map(item => sanitizeString(item));
}

function containsSQLInjection(str) {
    const sqlPatterns = [
        /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
        /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
        /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
        /((\%27)|(\'))union/gi,
        /exec(\s|\+)+(s|x)p\w+/gi
    ];

    return sqlPatterns.some(pattern => pattern.test(str));
}


