import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import { getSettings, updateSettings } from "../controllers/adminSettingsController.js";

const router = express.Router();

router.get("/", getSettings); // Publicly accessible for the frontend to show fees
router.put("/", protect, restrictTo('admin'), updateSettings);

export default router;
