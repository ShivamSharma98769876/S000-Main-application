/**
 * Unit Tests for Cart Functionality
 */

const { calculateDates, calculatePrice } = require('../../utils/cart');
const { addDays, addYears, format } = require('date-fns');

describe('Cart Utilities', () => {
    describe('calculateDates', () => {
        test('should calculate correct dates for monthly duration', () => {
            const startDate = new Date('2025-01-01');
            const result = calculateDates(startDate, 'MONTH', 3);
            
            expect(result.startDate).toBe('2025-01-01');
            expect(result.endDate).toBe('2025-03-31'); // 90 days later
        });

        test('should calculate correct dates for yearly duration', () => {
            const startDate = new Date('2025-01-01');
            const result = calculateDates(startDate, 'YEAR', 1);
            
            expect(result.startDate).toBe('2025-01-01');
            expect(result.endDate).toBe('2026-01-01');
        });

        test('should handle multiple years', () => {
            const startDate = new Date('2025-01-01');
            const result = calculateDates(startDate, 'YEAR', 2);
            
            expect(result.startDate).toBe('2025-01-01');
            expect(result.endDate).toBe('2027-01-01');
        });
    });

    describe('calculatePrice', () => {
        const product = {
            price_per_month: 2999,
            price_per_year: 29999
        };

        test('should calculate correct price for monthly subscription', () => {
            const price = calculatePrice(product, 'MONTH', 3);
            expect(price).toBe(8997); // 2999 * 3
        });

        test('should calculate correct price for yearly subscription', () => {
            const price = calculatePrice(product, 'YEAR', 2);
            expect(price).toBe(59998); // 29999 * 2
        });

        test('should handle single month', () => {
            const price = calculatePrice(product, 'MONTH', 1);
            expect(price).toBe(2999);
        });

        test('should handle single year', () => {
            const price = calculatePrice(product, 'YEAR', 1);
            expect(price).toBe(29999);
        });
    });
});

describe('Cart Validation', () => {
    test('should validate duration value range', () => {
        expect(() => validateDuration(0)).toThrow();
        expect(() => validateDuration(13)).toThrow();
        expect(() => validateDuration(1)).not.toThrow();
        expect(() => validateDuration(12)).not.toThrow();
    });

    test('should validate duration unit', () => {
        expect(() => validateDurationUnit('MONTH')).not.toThrow();
        expect(() => validateDurationUnit('YEAR')).not.toThrow();
        expect(() => validateDurationUnit('DAY')).toThrow();
        expect(() => validateDurationUnit('WEEK')).toThrow();
    });
});

// Helper functions for testing
function validateDuration(value) {
    if (value < 1 || value > 12) {
        throw new Error('Duration must be between 1 and 12');
    }
}

function validateDurationUnit(unit) {
    if (!['MONTH', 'YEAR'].includes(unit)) {
        throw new Error('Duration unit must be MONTH or YEAR');
    }
}


