const nodemailer = require('nodemailer');
const logger = require('../config/logger');

// Create email transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    },
    tls: {
        // For development: ignore certificate validation issues
        // Remove in production or configure proper certificates
        rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
});

// Verify transporter connection
transporter.verify((error, success) => {
    if (error) {
        logger.error('Email transporter verification failed', error);
    } else {
        logger.info('Email transporter is ready');
    }
});

// Send email helper
async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"TradingPro" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
            to,
            subject,
            html
        });
        
        logger.info('Email sent', { to, subject, messageId: info.messageId });
        return info;
    } catch (error) {
        logger.error('Failed to send email', { to, subject, error: error.message });
        throw error;
    }
}

// Send payment received email to user
async function sendPaymentReceivedEmail(userEmail, userName, orderId, totalAmount) {
    const subject = 'Payment Received - Order Pending Approval';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                .order-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Payment Received!</h1>
                </div>
                <div class="content">
                    <p>Dear ${userName || 'Valued Customer'},</p>
                    
                    <p>We have received your payment proof for order <strong>#${orderId}</strong>.</p>
                    
                    <div class="order-details">
                        <h3>Order Summary</h3>
                        <p><strong>Order ID:</strong> #${orderId}</p>
                        <p><strong>Amount:</strong> ₹${totalAmount}</p>
                        <p><strong>Status:</strong> Pending Admin Approval</p>
                    </div>
                    
                    <p>Our team will review your payment and approve your subscription shortly. You will receive a confirmation email once your subscription is activated.</p>
                    
                    <p>This process typically takes 1-2 business hours during working hours.</p>
                    
                    <a href="${process.env.FRONTEND_URL}/dashboard.html" class="button">View Dashboard</a>
                    
                    <p style="margin-top: 30px;">If you have any questions, please contact our support team.</p>
                </div>
                <div class="footer">
                    <p>© 2025 TradingPro. All rights reserved.</p>
                    <p>Mumbai, Maharashtra, India | support@tradingpro.com | +91 88888 88888</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return sendEmail(userEmail, subject, html);
}

// Send new order notification to admin
async function sendAdminNewOrderEmail(orderId, userName, userEmail, totalAmount, itemCount) {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    const subject = `New Order Pending Approval - #${orderId}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .order-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>⚠️ New Order Pending</h1>
                </div>
                <div class="content">
                    <p>A new subscription order is pending your approval.</p>
                    
                    <div class="order-details">
                        <h3>Order Details</h3>
                        <p><strong>Order ID:</strong> #${orderId}</p>
                        <p><strong>Customer:</strong> ${userName || 'N/A'}</p>
                        <p><strong>Email:</strong> ${userEmail}</p>
                        <p><strong>Amount:</strong> ₹${totalAmount}</p>
                        <p><strong>Items:</strong> ${itemCount} product(s)</p>
                    </div>
                    
                    <p>Please review the payment proof and approve or reject the order.</p>
                    
                    <a href="${process.env.FRONTEND_URL}/admin/orders.html" class="button">Review Order</a>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return sendEmail(adminEmail, subject, html);
}

// Send order approved email to user
async function sendOrderApprovedEmail(userEmail, userName, orderId, subscriptions) {
    const subject = 'Subscription Activated - Order Approved';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .success-icon { font-size: 60px; text-align: center; margin: 20px 0; }
                .subscription-list { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
                .subscription-item { border-bottom: 1px solid #eee; padding: 15px 0; }
                .subscription-item:last-child { border-bottom: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Order Approved!</h1>
                </div>
                <div class="content">
                    <div class="success-icon">✅</div>
                    
                    <p>Dear ${userName || 'Valued Customer'},</p>
                    
                    <p>Great news! Your order <strong>#${orderId}</strong> has been approved and your subscriptions are now active.</p>
                    
                    <div class="subscription-list">
                        <h3>Your Active Subscriptions</h3>
                        ${subscriptions && subscriptions.length > 0 ? subscriptions.map(sub => `
                            <div class="subscription-item">
                                <strong>${sub.productName || 'Product'}</strong><br>
                                <small>Valid: ${sub.startDate} to ${sub.endDate}</small>
                            </div>
                        `).join('') : '<p>Subscriptions will be activated shortly.</p>'}
                    </div>
                    
                    <p>You can now access all your subscribed products from your dashboard.</p>
                    
                    <a href="${process.env.FRONTEND_URL}/dashboard.html" class="button">Go to Dashboard</a>
                    
                    <p style="margin-top: 30px;">Thank you for choosing TradingPro!</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return sendEmail(userEmail, subject, html);
}

// Send order rejected email to user
async function sendOrderRejectedEmail(userEmail, userName, orderId, reason) {
    const subject = 'Order Update - Further Action Required';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .reason-box { background: #fee; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Order Update Required</h1>
                </div>
                <div class="content">
                    <p>Dear ${userName || 'Valued Customer'},</p>
                    
                    <p>We regret to inform you that your order <strong>#${orderId}</strong> could not be approved at this time.</p>
                    
                    ${reason ? `
                        <div class="reason-box">
                            <strong>Reason:</strong><br>
                            ${reason}
                        </div>
                    ` : ''}
                    
                    <p>Please review your payment details and try again. If you believe this is an error, please contact our support team with your order ID.</p>
                    
                    <a href="${process.env.FRONTEND_URL}/products.html" class="button">Try Again</a>
                    
                    <p style="margin-top: 30px;">
                        <strong>Need Help?</strong><br>
                        Email: support@tradingpro.com<br>
                        Phone: +91 88888 88888
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return sendEmail(userEmail, subject, html);
}

module.exports = {
    sendEmail,
    sendPaymentReceivedEmail,
    sendAdminNewOrderEmail,
    sendOrderApprovedEmail,
    sendOrderRejectedEmail
};


