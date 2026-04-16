import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
  createRenovationRequest,
  getAllRenovationRequests,
  getMyRenovationRequests,
  getAvailableProviders,
  getRenovationRequest,
  submitQuote,
  acceptQuote,
  getAvailableRenovationRequests,
  getAcceptedRenovationRequests,
  updateRenovationStatus,
  rateRenovation,
  cancelRenovationRequest,
  getProviderDiagnostics
} from '../controllers/renovationController.js';

const router = express.Router();

// Public routes - Get available providers and all requests (for browsing)
router.get('/providers', getAvailableProviders);
router.get('/browse', getAllRenovationRequests);

// Protected routes - Require authentication
router.use(protect);

// Provider routes - MUST come before generic /:id route
router.get('/provider/available', restrictTo('serviceProvider'), getAvailableRenovationRequests);
router.get('/provider/accepted', restrictTo('serviceProvider'), getAcceptedRenovationRequests);
router.get('/provider/diagnostics', restrictTo('serviceProvider'), getProviderDiagnostics);
router.post('/:renovationRequestId/quote', restrictTo('serviceProvider'), submitQuote);
router.patch('/:id/status', restrictTo('serviceProvider'), updateRenovationStatus);

// Customer routes - MUST come after provider routes
router.get('/my-requests', getMyRenovationRequests);
router.post('/', createRenovationRequest);
router.get('/:id', getRenovationRequest);
router.patch('/:id/accept-quote/:providerId', restrictTo('customer'), acceptQuote);
router.patch('/:id/cancel', restrictTo('customer'), cancelRenovationRequest);
router.patch('/:id/rate', restrictTo('customer'), rateRenovation);

export default router;
