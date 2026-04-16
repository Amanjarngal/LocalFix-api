import mongoose from "mongoose";

const providerSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false, // Optional for initial enrollment
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        ownerName: {
            type: String,
            required: true,
            trim: true,
        },
        businessName: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
        },
        dob: {
            type: Date,
            required: true,
        },
        gender: {
            type: String,
            enum: ["Male", "Female", "Other", "Prefer not to say"],
        },
        profilePhoto: String,

        // Section 3: Professional Details
        primaryService: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            required: true,
        },
        additionalSkills: [String],
        experience: {
            type: Number,
            required: true,
            min: 0,
        },
        serviceCategory: String,
        certification: String, // Path to certificate file
        description: {
            type: String,
            maxLength: 1000,
        },

        // Section 4: Service Area & Availability
        address: {
            type: String,
            required: true,
        },
        city: {
            type: String,
            required: true,
        },
        area: {
            type: String,
            required: true,
        },
        pincode: {
            type: Number,
            required: true,
        },
        workingDays: [String],
        workingHours: {
            start: String,
            end: String,
        },
        emergencyAvailability: {
            type: Boolean,
            default: false,
        },

        // Service Areas - multiple pincodes the provider covers
        serviceAreas: [
            {
                pincode: { type: String, required: true, trim: true },
                areaName: { type: String, trim: true, default: '' },
            }
        ],

        // Provider availability toggle (online / offline)
        isAvailable: {
            type: Boolean,
            default: true,
        },

        // Section 5: Identity Verification
        idProof: {
            idType: {
                type: String,
                enum: ["Aadhar", "PAN", "Driving License", "Passport"],
                required: true,
            },
            idNumber: {
                type: String,
                required: true,
            },
            idImage: String,
        },
        documents: [
            {
                name: String,
                path: String,
                uploadDate: { type: Date, default: Date.now },
            },
        ],

        // Bank Details for Razorpay Route (Split Payments)
        bankDetails: {
            accountNumber: { type: String, default: '' },
            ifscCode: { type: String, default: '' },
            accountHolderName: { type: String, default: '' },
            bankName: { type: String, default: '' },
            upiId: { type: String, default: '' },
        },
        razorpayAccountId: {
            type: String,
            default: '',
        },
        payoutMethod: {
            type: String,
            enum: ['bank_transfer', 'upi', ''],
            default: '',
        },

        verified: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
    },
    {
        timestamps: true,
    }
);

export const Provider = mongoose.models.Provider || mongoose.model("Provider", providerSchema);
