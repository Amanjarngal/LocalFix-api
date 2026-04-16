import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  },
  raisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  raisedByRole: {
    type: String,
    enum: ['customer', 'provider'],
    required: true,
  },
  against: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
  },

  description: {
    type: String,
    required: true,
    maxlength: 1500,
  },
  aiCategory: {
    type: String,
    enum: [
      'payment_related',
      'service_quality',       // complaints about provider/service
      'technical_system',      // app bugs, login, notifications, payments gateway etc.
      'other',
      null
    ],
    default: null,
    index: true,
  },

  // Gemini confidence score (0–1)
  aiConfidence: {
    type: Number,
    min: 0,
    max: 1,
    default: null,
  },

  // Gemini-refined / improved description (cleaner, structured, polite)
  aiRefinedDescription: {
    type: String,
    maxlength: 2000,
    default: null,
  },

  // Gemini-suggested resolution steps / first action
  aiSuggestedResolution: {
    type: String,
    maxlength: 1500,
    default: null,
  },

  // When Gemini processed this complaint
  aiProcessedAt: {
    type: Date,
    default: null,
  },

  // Which exact Gemini model was used (important for free tier + migration)
  // Examples: "gemini-2.5-flash", "gemini-2.5-flash-001", "gemini-2.0-flash-exp-1209", etc.
  geminiModelUsed: {
    type: String,
    default: null,
    // You can set this in your code, e.g. "gemini-2.5-flash"
  },

  // Optional: store the raw Gemini response JSON (for debugging)
  geminiRawResponse: {
    type: mongoose.Schema.Types.Mixed,   // can be object/string
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'closed', 'rejected'],
    default: 'pending',
    index: true,
  },
  adminResponse: {
    type: String,
    maxlength: 1500,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolvedAt: Date,
  attachments: [{
    name: String,
    path: String,
    uploadDate: { type: Date, default: Date.now },
  }],

}, {
  timestamps: true,
});
complaintSchema.index({ booking: 1, status: 1 });
complaintSchema.index({ raisedBy: 1, createdAt: -1 });
complaintSchema.index({ aiCategory: 1, status: 1 });
complaintSchema.index({ geminiModelUsed: 1, aiProcessedAt: -1 });
complaintSchema.index({ status: 1, aiProcessedAt: -1 });

export const Complaint = mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);