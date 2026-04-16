
import mongoose from "mongoose";
import { Problem } from "../models/serviceSchema.js";
import { Service } from "../models/serviceSchema.js";

// Create Problem
export const createProblem = async (req, res) => {
    try {
        const { serviceId, title, description, price } = req.body;

        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }

        const problem = await Problem.create({
            service: serviceId,
            title,
            description,
            price,
        });

        res.status(201).json({
            message: "Problem created successfully",
            success: true,
            data: problem,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get Problems by Service ID (Filtered by Provider)
export const getProblemsByServiceId = async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { providerId } = req.query;

        let query = { service: serviceId };
        
        if (providerId) {
            // Show only what this specific provider offers
            query.provider = providerId;
        } else {
            // Public browsing without provider: show global/template problems
            query.provider = null;
        }

        const problems = await Problem.find(query).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: problems,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get Single Problem
export const getProblemById = async (req, res) => {
    try {
        const problem = await Problem.findById(req.params.id);
        if (!problem) {
            return res.status(404).json({ message: "Problem not found" });
        }
        res.status(200).json({
            success: true,
            data: problem,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update Problem
export const updateProblem = async (req, res) => {
    try {
        const problem = await Problem.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!problem) {
            return res.status(404).json({ message: "Problem not found" });
        }

        res.status(200).json({
            message: "Problem updated successfully",
            success: true,
            data: problem,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ✅ PROVIDER: Create Specialty
export const createProviderSpecialty = async (req, res) => {
    try {
        const { serviceId, title, description, price } = req.body;
        // req.user contains the user, we need to find the provider linked to it
        const provider = await mongoose.model("Provider").findOne({ user: req.user._id });
        
        if (!provider) {
            return res.status(404).json({ message: "Provider profile not found" });
        }

        const problem = await Problem.create({
            service: serviceId,
            title,
            description,
            price,
            provider: provider._id
        });

        res.status(201).json({
            message: "Specialty added successfully",
            success: true,
            data: problem,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ✅ PROVIDER: Get My Specialties
export const getMySpecialties = async (req, res) => {
    try {
        const provider = await mongoose.model("Provider").findOne({ user: req.user._id });
        if (!provider) return res.status(404).json({ message: "Provider not found" });

        const specialties = await Problem.find({ provider: provider._id })
            .populate("service", "name")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: specialties,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ✅ PROVIDER: Update Specialty
export const updateProviderSpecialty = async (req, res) => {
    try {
        const provider = await mongoose.model("Provider").findOne({ user: req.user._id });
        const problem = await Problem.findOne({ _id: req.params.id, provider: provider?._id });

        if (!problem) {
            return res.status(404).json({ message: "Specialty not found or unauthorized" });
        }

        Object.assign(problem, req.body);
        await problem.save();

        res.status(200).json({
            message: "Specialty updated",
            success: true,
            data: problem,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ✅ PROVIDER: Delete Specialty
export const deleteProviderSpecialty = async (req, res) => {
    try {
        const provider = await mongoose.model("Provider").findOne({ user: req.user._id });
        const problem = await Problem.findOneAndDelete({ _id: req.params.id, provider: provider?._id });

        if (!problem) {
            return res.status(404).json({ message: "Specialty not found or unauthorized" });
        }

        res.status(200).json({
            message: "Specialty deleted successfully",
            success: true,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ✅ ADMIN: Delete Problem
export const deleteProblem = async (req, res) => {
    try {
        const problem = await Problem.findByIdAndDelete(req.params.id);
        if (!problem) {
            return res.status(404).json({ message: "Problem not found" });
        }
        res.status(200).json({
            message: "Problem deleted successfully",
            success: true,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
