import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import multer from 'multer';
import {
  raiseComplaint,
  getComplaints,
  updateComplaint,
  startAIChatForComplaint,
  sendMessageToAIChat,
  finalizeComplaintWithAI,
} from '../controllers/complaintController.js';

const router = express.Router();

const upload = multer({ dest: 'uploads/complaints/' });

// Raise complaint normally (with optional attachments)
router.post(
  '/',
  protect,
  upload.array('attachments', 5),
  raiseComplaint
);

// Get complaints (user's own or all for admin)
router.get('/', protect, getComplaints);

// Admin only: update complaint status/response
router.patch('/:id', protect, restrictTo('admin'), updateComplaint);

// ────────────────────────────────────────────────
// NEW: AI Chatbot routes for assisted complaint creation
// ────────────────────────────────────────────────

// Start AI chat session for a booking
router.post(
  '/ai-chat/start',
  protect,
  startAIChatForComplaint
);

// Send message to the AI chat (multi-turn)
router.post(
  '/ai-chat/message',
  protect,
  sendMessageToAIChat
);

// Finalize chat → create real Complaint
router.post(
  '/ai-chat/finalize',
  protect,
  finalizeComplaintWithAI
);

export default router;