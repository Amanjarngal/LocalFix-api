import express from 'express';
import { createOrder, verifyPayment, refundPayment } from '../controllers/paymentController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);

// Admin Refund
router.post('/refund', protect, restrictTo('admin'), refundPayment);

export default router;
