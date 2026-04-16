import { Service } from "../models/serviceSchema.js";

// Create Service
export const createService = async (req, res) => {
    try {
        const { name, description, icon } = req.body;

        const existingService = await Service.findOne({ name });
        if (existingService) {
            return res.status(400).json({ message: "Service already exists" });
        }

        const service = await Service.create({
            name,
            description,
            icon,
        });

        res.status(201).json({
            message: "Service created successfully",
            success: true,
            data: service,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get All Services
export const getAllServices = async (req, res) => {
    try {
        const services = await Service.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: services,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get Single Service
export const getServiceById = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }
        res.status(200).json({
            success: true,
            data: service,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update Service
export const updateService = async (req, res) => {
    try {
        const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }

        res.status(200).json({
            message: "Service updated successfully",
            success: true,
            data: service,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Delete Service
export const deleteService = async (req, res) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);
        if (!service) {
            return res.status(404).json({ message: "Service not found" });
        }
        res.status(200).json({
            message: "Service deleted successfully",
            success: true,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
