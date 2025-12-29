const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const logger = require('../config/logger');

// Configure multer for QR code uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'qr-code-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed'));
    }
});

// ==================== PUBLIC ENDPOINTS ====================

// Get active offers
router.get('/offers', async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM offers WHERE status = $1 ORDER BY display_order, created_at DESC',
            ['ACTIVE']
        );
        
        res.json({ offers: result.rows });
    } catch (error) {
        logger.error('Error fetching offers', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch offers'
        });
    }
});

// Get active testimonials (public - only approved)
router.get('/testimonials', async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM testimonials WHERE status = $1 ORDER BY display_order, created_at DESC',
            ['ACTIVE']
        );
        
        res.json({ testimonials: result.rows });
    } catch (error) {
        logger.error('Error fetching testimonials', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch testimonials'
        });
    }
});

// Submit testimonial (authenticated user)
router.post('/testimonials', isAuthenticated, async (req, res) => {
    try {
        const { authorName, authorRole, authorInitials, content, rating } = req.body;
        
        // Validate required fields
        if (!authorName || !content) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Author name and content are required'
            });
        }

        // Generate initials from name if not provided
        const initials = authorInitials || authorName
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

        // Get user profile for default values
        const userProfile = await query(
            `SELECT up.full_name, up.phone 
             FROM user_profiles up 
             WHERE up.user_id = $1`,
            [req.user.id]
        );

        const finalAuthorName = authorName || userProfile.rows[0]?.full_name || req.user.email.split('@')[0];
        const finalAuthorRole = authorRole || 'Trader';
        
        // Insert testimonial with PENDING status
        const result = await query(
            `INSERT INTO testimonials (user_id, author_name, author_role, author_initials, content, rating, status, display_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
             RETURNING *`,
            [
                req.user.id,
                finalAuthorName,
                finalAuthorRole,
                initials,
                content,
                rating || 5,
                'PENDING', // New testimonials start as PENDING
                0
            ]
        );
        
        logger.info('Testimonial submitted by user', { 
            testimonialId: result.rows[0].id, 
            userId: req.user.id 
        });
        
        res.status(201).json({
            message: 'Testimonial submitted successfully! It will be reviewed by admin before being published.',
            testimonial: result.rows[0]
        });
    } catch (error) {
        logger.error('Error submitting testimonial', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to submit testimonial'
        });
    }
});

// Get user's own testimonials
router.get('/testimonials/my', isAuthenticated, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, author_name, author_role, content, rating, status, created_at, updated_at
             FROM testimonials 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        
        res.json({ testimonials: result.rows });
    } catch (error) {
        logger.error('Error fetching user testimonials', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch testimonials'
        });
    }
});

// Get system config (public values only)
router.get('/config', async (req, res) => {
    try {
        const result = await query(
            'SELECT config_key, config_value FROM system_config WHERE config_key IN ($1, $2, $3, $4, $5)',
            ['qr_code_url', 'support_email', 'company_name', 'upi_id', 'merchant_name']
        );
        
        const config = {};
        result.rows.forEach(row => {
            config[row.config_key] = row.config_value;
        });
        
        res.json({ config });
    } catch (error) {
        logger.error('Error fetching config', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch configuration'
        });
    }
});

// ==================== ADMIN ENDPOINTS ====================

// Get all offers (admin)
router.get('/admin/offers', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM offers ORDER BY display_order, created_at DESC'
        );
        
        res.json({ offers: result.rows });
    } catch (error) {
        logger.error('Error fetching all offers', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch offers'
        });
    }
});

// Create offer (admin)
router.post('/admin/offers', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { title, description, discountText, badgeText, validityText, ctaText, ctaLink, status, displayOrder } = req.body;
        
        const result = await query(
            `INSERT INTO offers (title, description, discount_text, badge_text, validity_text, cta_text, cta_link, status, display_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
             RETURNING *`,
            [title, description, discountText, badgeText || null, validityText || null, ctaText || 'Claim Offer', ctaLink || null, status || 'ACTIVE', displayOrder || 0]
        );
        
        logger.info('Offer created', { offerId: result.rows[0].id, adminId: req.user.id });
        
        res.status(201).json({
            message: 'Offer created successfully',
            offer: result.rows[0]
        });
    } catch (error) {
        logger.error('Error creating offer', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create offer'
        });
    }
});

// Update offer (admin)
router.put('/admin/offers/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { title, description, discountText, badgeText, validityText, ctaText, ctaLink, status, displayOrder } = req.body;
        
        const result = await query(
            `UPDATE offers 
             SET title = $1, description = $2, discount_text = $3, badge_text = $4, validity_text = $5, 
                 cta_text = $6, cta_link = $7, status = $8, display_order = $9, updated_at = NOW()
             WHERE id = $10
             RETURNING *`,
            [title, description, discountText, badgeText || null, validityText || null, ctaText || 'Claim Offer', ctaLink || null, status || 'ACTIVE', displayOrder || 0, req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Offer not found'
            });
        }
        
        logger.info('Offer updated', { offerId: req.params.id, adminId: req.user.id });
        
        res.json({
            message: 'Offer updated successfully',
            offer: result.rows[0]
        });
    } catch (error) {
        logger.error('Error updating offer', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update offer'
        });
    }
});

// Delete offer (admin)
router.delete('/admin/offers/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await query(
            'DELETE FROM offers WHERE id = $1 RETURNING id',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Offer not found'
            });
        }
        
        logger.info('Offer deleted', { offerId: req.params.id, adminId: req.user.id });
        
        res.json({ message: 'Offer deleted successfully' });
    } catch (error) {
        logger.error('Error deleting offer', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete offer'
        });
    }
});

// Get all testimonials (admin) - includes pending
router.get('/admin/testimonials', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT t.*, u.email as user_email FROM testimonials t LEFT JOIN users u ON t.user_id = u.id';
        const params = [];
        
        if (status) {
            query += ' WHERE t.status = $1';
            params.push(status);
        }
        
        query += ' ORDER BY CASE WHEN t.status = \'PENDING\' THEN 0 ELSE 1 END, t.display_order, t.created_at DESC';
        
        const result = await query(query, params);
        
        res.json({ testimonials: result.rows });
    } catch (error) {
        logger.error('Error fetching all testimonials', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch testimonials'
        });
    }
});

// Create testimonial (admin)
router.post('/admin/testimonials', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { authorName, authorRole, authorInitials, content, rating, status, displayOrder } = req.body;
        
        const result = await query(
            `INSERT INTO testimonials (author_name, author_role, author_initials, content, rating, status, display_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             RETURNING *`,
            [authorName, authorRole, authorInitials, content, rating || 5, status || 'ACTIVE', displayOrder || 0]
        );
        
        logger.info('Testimonial created', { testimonialId: result.rows[0].id, adminId: req.user.id });
        
        res.status(201).json({
            message: 'Testimonial created successfully',
            testimonial: result.rows[0]
        });
    } catch (error) {
        logger.error('Error creating testimonial', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create testimonial'
        });
    }
});

// Approve testimonial (admin)
router.post('/admin/testimonials/:id/approve', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { displayOrder } = req.body;
        
        const result = await query(
            `UPDATE testimonials 
             SET status = 'ACTIVE', display_order = COALESCE($1, display_order), updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [displayOrder, req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Testimonial not found'
            });
        }
        
        logger.info('Testimonial approved', { testimonialId: req.params.id, adminId: req.user.id });
        
        res.json({
            message: 'Testimonial approved successfully',
            testimonial: result.rows[0]
        });
    } catch (error) {
        logger.error('Error approving testimonial', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to approve testimonial'
        });
    }
});

// Reject testimonial (admin)
router.post('/admin/testimonials/:id/reject', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await query(
            `UPDATE testimonials 
             SET status = 'INACTIVE', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Testimonial not found'
            });
        }
        
        logger.info('Testimonial rejected', { testimonialId: req.params.id, adminId: req.user.id });
        
        res.json({
            message: 'Testimonial rejected',
            testimonial: result.rows[0]
        });
    } catch (error) {
        logger.error('Error rejecting testimonial', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to reject testimonial'
        });
    }
});

// Update testimonial (admin)
router.put('/admin/testimonials/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { authorName, authorRole, authorInitials, content, rating, status, displayOrder } = req.body;
        
        const result = await query(
            `UPDATE testimonials 
             SET author_name = $1, author_role = $2, author_initials = $3, content = $4, 
                 rating = $5, status = $6, display_order = $7, updated_at = NOW()
             WHERE id = $8
             RETURNING *`,
            [authorName, authorRole, authorInitials, content, rating || 5, status || 'ACTIVE', displayOrder || 0, req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Testimonial not found'
            });
        }
        
        logger.info('Testimonial updated', { testimonialId: req.params.id, adminId: req.user.id });
        
        res.json({
            message: 'Testimonial updated successfully',
            testimonial: result.rows[0]
        });
    } catch (error) {
        logger.error('Error updating testimonial', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update testimonial'
        });
    }
});

// Delete testimonial (admin)
router.delete('/admin/testimonials/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await query(
            'DELETE FROM testimonials WHERE id = $1 RETURNING id',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Testimonial not found'
            });
        }
        
        logger.info('Testimonial deleted', { testimonialId: req.params.id, adminId: req.user.id });
        
        res.json({ message: 'Testimonial deleted successfully' });
    } catch (error) {
        logger.error('Error deleting testimonial', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete testimonial'
        });
    }
});

// Get all system config (admin)
router.get('/admin/config', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await query(
            'SELECT config_key as key, config_value as value, updated_at FROM system_config ORDER BY config_key'
        );
        
        res.json({ config: result.rows });
    } catch (error) {
        logger.error('Error fetching system config', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch configuration'
        });
    }
});

// Upload QR code image (admin)
router.post('/admin/config/qr-code/upload', isAuthenticated, isAdmin, upload.single('qr_code'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'No file uploaded'
            });
        }

        // Generate URL for the uploaded file
        const fileUrl = `/uploads/${req.file.filename}`;
        
        // Save the URL to system_config
        const result = await query(
            `INSERT INTO system_config (config_key, config_value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (config_key) 
             DO UPDATE SET config_value = $2, updated_at = NOW()
             RETURNING config_key as key, config_value as value, updated_at`,
            ['qr_code_url', fileUrl]
        );
        
        logger.info('QR code uploaded', { filename: req.file.filename, adminId: req.user.id });
        
        res.json({
            message: 'QR code uploaded successfully',
            url: fileUrl,
            config: result.rows[0]
        });
    } catch (error) {
        logger.error('Error uploading QR code', error);
        
        // Clean up uploaded file if config save failed
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message || 'Failed to upload QR code'
        });
    }
});

// Update system config (admin)
router.put('/admin/config/:key', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { value } = req.body;
        
        if (value === undefined || value === null) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Value is required'
            });
        }
        
        const result = await query(
            `INSERT INTO system_config (config_key, config_value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (config_key) 
             DO UPDATE SET config_value = $2, updated_at = NOW()
             RETURNING config_key as key, config_value as value, updated_at`,
            [req.params.key, value]
        );
        
        logger.info('System config updated', { key: req.params.key, adminId: req.user.id });
        
        res.json({
            message: 'Configuration updated successfully',
            config: result.rows[0]
        });
    } catch (error) {
        logger.error('Error updating system config', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message || 'Failed to update configuration'
        });
    }
});

module.exports = router;


