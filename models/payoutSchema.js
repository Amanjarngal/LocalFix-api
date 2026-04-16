import mongoose from 'mongoose';

const payoutSchema = new mongoose.Schema({
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
    },
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    platformFee: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'on_hold'],
        default: 'pending',
    },
    paidAt: {
        type: Date,
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Admin who marked it paid
    },
    paymentMode: {
        type: String,
        enum: ['bank_transfer', 'upi', 'cash', 'razorpay', ''],
        default: '',
    },
    transactionRef: {
        type: String,
        default: '',
    },
    adminNote: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});

export const Payout = mongoose.models.Payout || mongoose.model('Payout', payoutSchema);
