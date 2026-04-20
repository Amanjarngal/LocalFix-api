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
  getProviderDiagnostics,
  twimlInitial,
  twimlProcess
} from '../controllers/renovationController.js';
import { Renovation } from '../models/renovationSchema.js';

const router = express.Router();

// Public routes - Get available providers and all requests (for browsing)
router.get('/providers', getAvailableProviders);
router.get('/browse', getAllRenovationRequests);

// Public routes for Twilio (NO AUTH required as Twilio calls these from outside)
router.post('/twiml/initial/:id', twimlInitial);
router.post('/twiml/process/:id', twimlProcess);

// Webhook for AI Call Summary (Legacy/Bland AI support)
router.post('/webhook/ai-call-summary', async (req, res) => {
    try {
        const { call_id, summary, metadata } = req.body;
        const renovationId = metadata?.renovation_id;

        if (renovationId) {
            await Renovation.findByIdAndUpdate(renovationId, {
                aiCallStatus: 'completed',
                aiCallSummary: summary || 'Call finished.',
            });
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

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
