import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: false
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  problemItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem',
    required: true
  }],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'en_route', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
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
  customerNotes: {
    type: String
  },
  totalPrice: {
    type: Number,
    required: true
  },
  platformFee: {
    type: Number,
    default: 0
  },
  providerEarning: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'online'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  razorpayOrderId: {
    type: String
  },
  razorpayPaymentId: {
    type: String
  },
  cancelledBy: {
    type: String,
    enum: ['customer', 'provider', 'admin']
  },
  beforeImage: { type: String },
  afterImage: { type: String },
  providerRating: { type: Number, min: 1, max: 5 },
  providerReview: { type: String },
  customerRating: { type: Number, min: 1, max: 5 },
  customerReview: { type: String },
  transferId: { type: String, default: '' },
  transferStatus: {
    type: String,
    enum: ['pending', 'processed', 'failed', ''],
    default: ''
  }
}, {
  timestamps: true
});

export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);