const { body, param, query, validationResult } = require('express-validator');

// Validation error handler
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid input data',
            details: errors.array()
        });
    }
    next();
};

// User profile validation
const validateProfile = [
    body('fullName')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 255 }).withMessage('Full name must be between 2 and 255 characters'),
    body('address')
        .trim()
        .notEmpty().withMessage('Address is required')
        .isLength({ min: 5, max: 500 }).withMessage('Address must be between 5 and 500 characters'),
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/).withMessage('Invalid phone number format'),
    body('capitalUsed')
        .notEmpty().withMessage('Capital used for trading is required')
        .isFloat({ min: 0 }).withMessage('Capital must be a positive number'),
    body('zerodhaClientId')
        .trim()
        .notEmpty().withMessage('Zerodha Client ID is required')
        .isLength({ min: 2, max: 50 }).withMessage('Zerodha Client ID must be between 2 and 50 characters'),
    body('referralCode')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Referral code must be less than 50 characters'),
    validate
];

// Product validation
const validateProduct = [
    body('name')
        .trim()
        .notEmpty().withMessage('Product name is required')
        .isLength({ min: 2, max: 255 }).withMessage('Product name must be between 2 and 255 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 }).withMessage('Description must be less than 2000 characters'),
    body('category')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Category must be less than 100 characters'),
    body('monthlyPrice')
        .notEmpty().withMessage('Monthly price is required')
        .isFloat({ min: 0 }).withMessage('Monthly price must be a positive number'),
    body('yearlyPrice')
        .notEmpty().withMessage('Yearly price is required')
        .isFloat({ min: 0 }).withMessage('Yearly price must be a positive number'),
    body('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE']).withMessage('Status must be ACTIVE or INACTIVE'),
    validate
];

// Cart item validation
const validateCartItem = [
    body('productId')
        .notEmpty().withMessage('Product ID is required')
        .isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
    body('durationType')
        .notEmpty().withMessage('Duration type is required')
        .isIn(['MONTH', 'YEAR']).withMessage('Duration type must be MONTH or YEAR'),
    body('durationUnits')
        .notEmpty().withMessage('Duration units is required')
        .isInt({ min: 1, max: 12 }).withMessage('Duration units must be between 1 and 12'),
    validate
];

// Order validation
const validateOrder = [
    body('paymentReference')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Payment reference must be less than 100 characters'),
    body('paymentDate')
        .optional()
        .isISO8601().withMessage('Payment date must be a valid date'),
    validate
];

// Pagination validation
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('pageSize')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Page size must be between 1 and 100'),
    validate
];

module.exports = {
    validate,
    validateProfile,
    validateProduct,
    validateCartItem,
    validateOrder,
    validatePagination
};


