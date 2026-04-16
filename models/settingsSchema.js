import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        platformFee: {
            type: Number,
            default: 50, // Default 50 INR or percentage? Let's assume fixed for now as per "add fee"
        },
        feeType: {
            type: String,
            enum: ['fixed', 'percentage'],
            default: 'fixed'
        },
        razorpayEnabled: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
    }
);

export const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);
