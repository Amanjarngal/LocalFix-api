import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
    saveBankDetails,
    createLinkedAccount,
    getBankDetails,
    getProviderEarnings,
    getAllPayouts,
    markPayoutPaid,
    holdPayout,
    getPayoutStats,
    getWeeklySummary,
    bulkPayProvider,
    bulkPayAllProviders,
} from '../controllers/payoutController.js';

const router = express.Router();

// ── Provider routes ──────────────────────────────────
router.get('/bank-details', protect, getBankDetails);
router.post('/bank-details', protect, saveBankDetails);
router.post('/create-linked-account', protect, createLinkedAccount);
router.get('/my-earnings', protect, getProviderEarnings);

// ── Admin routes ─────────────────────────────────────
router.get('/all', protect, restrictTo('admin'), getAllPayouts);
router.get('/stats', protect, restrictTo('admin'), getPayoutStats);
router.get('/weekly-summary', protect, restrictTo('admin'), getWeeklySummary);
router.post('/bulk-pay-all', protect, restrictTo('admin'), bulkPayAllProviders);
router.patch('/:payoutId/mark-paid', protect, restrictTo('admin'), markPayoutPaid);
router.patch('/:payoutId/hold', protect, restrictTo('admin'), holdPayout);
router.post('/provider/:providerId/bulk-pay', protect, restrictTo('admin'), bulkPayProvider);

export default router;
