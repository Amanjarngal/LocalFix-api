import { Settings } from "../models/settingsSchema.js";

// Get Global Settings
export const getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({}); // Create default if doesn't exist
        }
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update Global Settings
export const updateSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings(req.body);
        } else {
            Object.assign(settings, req.body);
        }
        await settings.save();
        res.status(200).json({ success: true, message: "Settings updated", data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
