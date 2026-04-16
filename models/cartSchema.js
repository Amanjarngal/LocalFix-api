import mongoose from "mongoose";

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    items: [
        {
            problemId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Problem",
                required: true,
            },
            quantity: {
                type: Number,
                default: 1,
            },
            serviceName: {
                type: String, // Storing this for easier display, or could populate from Problem -> Service
            }
        },
    ],
    totalPrice: {
        type: Number,
        default: 0,
    },
});

export const Cart = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
