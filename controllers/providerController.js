import { Provider } from "../models/providerSchema.js";
import { User } from "../models/userSchema.js";
import fs from "fs";
import * as emailService from "../services/emailService.js";
import { hashedPassword } from "../utils/hashedPass.js";
import crypto from "crypto";

// Enroll Service Provider
export const enrollProvider = async (req, res) => {
    try {
        const {
            businessName, phone, dob, gender, primaryService,
            additionalSkills, experience, serviceCategory, description,
            address, city, area, pincode, workingDays, workingHours,
            emergencyAvailability, idType, idNumber, email, ownerName
        } = req.body;

        const userId = req.user?.id || req.body.userId;

        // Check if provider already exists by email (even if no userId)
        const existingProvider = await Provider.findOne({ email });
        if (existingProvider) {
            return res.status(400).json({ message: "An enrollment request with this email already exists" });
        }

        // Map files to specific fields (req.files is an object with fieldname keys when using upload.fields)
        const profilePhoto = req.files['profilePhoto']?.[0]?.path;
        const certification = req.files['certification']?.[0]?.path;
        const idImage = req.files['idImage']?.[0]?.path;

        const otherDocs = req.files['documents']?.map(file => ({
            name: file.originalname,
            path: file.path
        })) || [];

        const providerData = {
            email,
            ownerName,
            phone,
            dob,
            gender,
            profilePhoto,
            businessName,
            primaryService: (primaryService === "other" || !primaryService) ? null : primaryService,
            additionalSkills: additionalSkills ? JSON.parse(additionalSkills) : [],
            experience,
            serviceCategory,
            description,
            certification,
            address,
            city,
            area,
            pincode,
            workingDays: workingDays ? JSON.parse(workingDays) : [],
            workingHours: workingHours ? JSON.parse(workingHours) : {},
            emergencyAvailability: emergencyAvailability === 'true',
            idProof: {
                idType,
                idNumber,
                idImage,
            },
            documents: otherDocs,
        };

        if (userId) {
            providerData.user = userId;
        }

        const provider = await Provider.create(providerData);

        // Send confirmation email to provider
        await emailService.sendApplicationReceivedEmail(email, ownerName);

        res.status(201).json({
            message: "Enrollment request submitted successfully",
            success: true,
            data: provider,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get All Providers (Admin)
export const getAllProviders = async (req, res) => {
    try {
        const providers = await Provider.find()
            .populate("user", "name email")
            .populate("primaryService", "name");
        res.status(200).json({
            success: true,
            data: providers,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get Provider by ID/User ID
export const getProviderProfile = async (req, res) => {
    try {
        const provider = await Provider.findOne({
            $or: [{ _id: req.params.id }, { user: req.params.id }]
        })
            .populate("user", "name email")
            .populate("primaryService", "name");

        if (!provider) {
            return res.status(404).json({ message: "Provider profile not found" });
        }

        res.status(200).json({
            success: true,
            data: provider,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update Provider Profile
export const updateProviderProfile = async (req, res) => {
    try {
        const updateData = { ...req.body };

        // Parse stringified arrays/objects back into their original structure if they stringified by form-data
        if (updateData.additionalSkills && typeof updateData.additionalSkills === 'string') {
            updateData.additionalSkills = JSON.parse(updateData.additionalSkills);
        }
        if (updateData.workingDays && typeof updateData.workingDays === 'string') {
            updateData.workingDays = JSON.parse(updateData.workingDays);
        }
        if (updateData.workingHours && typeof updateData.workingHours === 'string') {
            updateData.workingHours = JSON.parse(updateData.workingHours);
        }
        if (updateData.emergencyAvailability) {
            updateData.emergencyAvailability = updateData.emergencyAvailability === 'true';
        }

        // Handle uploaded images from cloudinary
        if (req.files) {
            if (req.files['profilePhoto'] && req.files['profilePhoto'][0]) {
                updateData.profilePhoto = req.files['profilePhoto'][0].path; // Cloudinary URL automatically in path
            }
            if (req.files['certification'] && req.files['certification'][0]) {
                updateData.certification = req.files['certification'][0].path;
            }

            // If they are updating ID proof, we update idImage inside idProof object using dot notation or by fetching existing
        }

        const provider = await Provider.findOneAndUpdate(
            { user: req.params.id },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!provider) {
            return res.status(404).json({ message: "Provider profile not found" });
        }

        res.status(200).json({
            message: "Profile updated successfully",
            success: true,
            data: provider,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update Enrollment Status (Admin)
export const updateProviderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!["pending", "approved", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const provider = await Provider.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!provider) {
            return res.status(404).json({ message: "Provider not found" });
        }

        // Handle post-status update actions
        if (status === "approved") {
            let tempPassword = "";
            let user = null;

            if (provider.user) {
                // If user already exists, just update role
                user = await User.findByIdAndUpdate(provider.user, { role: "serviceProvider" });
            } else {
                // If no user linked, check if user exists by email or create new
                user = await User.findOne({ email: provider.email });

                if (!user) {
                    // Create new user with temp password
                    tempPassword = crypto.randomBytes(5).toString("hex"); // 10 chars
                    const hashed = await hashedPassword(tempPassword);
                    user = await User.create({
                        name: provider.ownerName,
                        email: provider.email,
                        password: hashed,
                        role: "serviceProvider",
                        isPasswordResetRequired: true
                    });
                } else {
                    // User exists, update role
                    user.role = "serviceProvider";
                    await user.save();
                }

                // Link provider to user
                provider.user = user._id;
                await provider.save();
            }

            // Send approval email with credentials if tempPassword was generated
            await emailService.sendApplicationApprovedEmail(
                provider.email,
                provider.ownerName,
                tempPassword ? { password: tempPassword } : null
            );
        } else if (status === "rejected") {
            // Send rejection email
            await emailService.sendApplicationRejectedEmail(provider.email, provider.ownerName, req.body.reason || "Your application does not meet our requirements at this time.");
        }

        res.status(200).json({
            message: `Enrollment request ${status}`,
            success: true,
            data: provider,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Delete Provider
export const deleteProvider = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) {
            return res.status(404).json({ message: "Provider not found" });
        }

        // Delete associated documents from storage
        provider.documents.forEach((doc) => {
            if (fs.existsSync(doc.path)) {
                fs.unlinkSync(doc.path);
            }
        });

        await Provider.findByIdAndDelete(req.params.id);

        res.status(200).json({
            message: "Provider profile and documents deleted successfully",
            success: true,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update Service Areas (Provider sets which pincodes/areas they cover)
export const updateServiceAreas = async (req, res) => {
    try {
        const { serviceAreas, workingDays, workingHours, emergencyAvailability, isAvailable } = req.body;

        const provider = await Provider.findOne({ user: req.user.id });
        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider profile not found" });
        }

        // Validate serviceAreas
        if (serviceAreas !== undefined) {
            if (!Array.isArray(serviceAreas)) {
                return res.status(400).json({ success: false, message: "serviceAreas must be an array" });
            }
            // Validate each area has a pincode
            for (const area of serviceAreas) {
                if (!area.pincode || !/^\d{6}$/.test(String(area.pincode).trim())) {
                    return res.status(400).json({ success: false, message: `Invalid pincode: "${area.pincode}". Must be a 6-digit number.` });
                }
            }
            provider.serviceAreas = serviceAreas.map(a => ({
                pincode: String(a.pincode).trim(),
                areaName: (a.areaName || '').trim(),
            }));
        }

        if (workingDays !== undefined) provider.workingDays = workingDays;
        if (workingHours !== undefined) provider.workingHours = workingHours;
        if (emergencyAvailability !== undefined) provider.emergencyAvailability = emergencyAvailability;
        if (isAvailable !== undefined) provider.isAvailable = isAvailable;

        await provider.save();

        res.status(200).json({
            success: true,
            message: "Availability settings updated successfully",
            data: {
                serviceAreas: provider.serviceAreas,
                workingDays: provider.workingDays,
                workingHours: provider.workingHours,
                emergencyAvailability: provider.emergencyAvailability,
                isAvailable: provider.isAvailable,
            },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get current provider's own availability info
export const getMyAvailability = async (req, res) => {
    try {
        const provider = await Provider.findOne({ user: req.user.id })
            .select('serviceAreas workingDays workingHours emergencyAvailability isAvailable pincode area city');
        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider profile not found" });
        }
        res.status(200).json({ success: true, data: provider });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

