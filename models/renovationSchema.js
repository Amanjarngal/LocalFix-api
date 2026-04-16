import mongoose from 'mongoose';

const renovationRequestSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  projectTitle: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  estimatedBudget: {
    type: Number,
    required: true
  },
  propertyType: {
    type: String,
    enum: ['1BHK', '2BHK', '3BHK', '4BHK', '5BHK', 'Commercial', 'Other'],
    required: true
  },
  renovationType: {
    type: String,
    enum: ['complete', 'partial', 'modular', 'kitchen', 'bathroom', 'bedroom', 'living-room', 'other'],
    required: true
  },
  projectScope: [{
    type: String,
    enum: ['painting', 'flooring', 'electrical', 'plumbing', 'carpentry', 'masonry', 'tiling', 'doors-windows', 'other']
  }],
  
  // Location & Contact Info
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  area: {
    type: String,
    required: true
  },
  pincode: {
    type: String,
    required: true
  },
  contactName: {
    type: String,
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  
  // Timeline
  preferredStartDate: {
    type: Date,
    required: true
  },
  estimatedDuration: {
    type: String, // e.g., "2 weeks", "1 month"
    required: true
  },
  
  // Images & Documents
  images: [String], // URLs of renovation photos
  
  // Tracking
  quotesReceived: {
    type: Number,
    default: 0
  },
  responses: [{
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider'
    },
    quote: Number,
    timeline: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Final Project Details (after acceptance)
  finalQuote: Number,
  finalTimeline: String,
  startDate: Date,
  completionDate: Date,
  actualCost: Number,
  
  // Rating & Review
  customerRating: { type: Number, min: 1, max: 5 },
  customerReview: String,
  providerRating: { type: Number, min: 1, max: 5 },
  providerReview: String,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const Renovation = mongoose.models.Renovation || mongoose.model('Renovation', renovationRequestSchema);
