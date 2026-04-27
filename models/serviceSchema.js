
import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        description: {
            type: String,
            required: true,
        },
        icon: {
            type: String,
            default: "Hammer",
        },
        image: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

export const Service =
    mongoose.models.Service || mongoose.model("Service", serviceSchema);

const problemSchema = new mongoose.Schema(
    {
        service: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        price: {
            type: Number,
            required: true,
        },
        provider: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Provider",
            default: null, // null means it's a global/admin-defined problem
        },
    },
    {
        timestamps: true,
    }
);

export const Problem =
    mongoose.models.Problem || mongoose.model("Problem", problemSchema);
