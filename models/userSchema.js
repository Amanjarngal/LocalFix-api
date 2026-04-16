import mongoose from "mongoose";
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "serviceProvider", "customer"],
      default: "customer",
    },
    addresses: [
      {
        line1: { type: String, required: true },
        area: { type: String, required: true },
        city: { type: String, required: true },
        pincode: { type: String, required: true },
        contactName: { type: String, required: true },
        contactNumber: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      }
    ],
    isPasswordResetRequired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    autoIndex: true,
  },
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
