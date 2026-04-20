import express from "express";
import { upload } from "../utils/multerConfig.js";
import { Provider } from "../models/providerSchema.js";
import { protect } from "../middleware/authMiddleware.js";
import {
    enrollProvider,
    getAllProviders,
    getProviderProfile,
    updateProviderProfile,
    updateProviderStatus,
    deleteProvider,
    updateServiceAreas,
    getMyAvailability,
    getProviderReviews,
    getProviderAvailabilityMonitor,
} from "../controllers/providerController.js";

const router = express.Router();

// Public: Get reviews for a specific provider
router.get("/:id/reviews", getProviderReviews);

// Public/Authenticated Enrollment
router.post(
    "/enroll",
    upload.fields([
        { name: "profilePhoto", maxCount: 1 },
        { name: "certification", maxCount: 1 },
        { name: "idImage", maxCount: 1 },
        { name: "documents", maxCount: 5 }
    ]),
    enrollProvider
);

// ✅ PUBLIC Search: Find providers by pincode and/or category
// GET /api/providers/search?pincode=123456&serviceId=xxx
router.get("/search", async (req, res) => {
    try {
        const { pincode, serviceId } = req.query;

        // Build query — only approved providers
        const query = {
            status: "approved"
        };

        // Filter by service if provided
        if (serviceId) {
            query.primaryService = serviceId;
        }

        // Filter by pincode — check BOTH main pincode AND serviceAreas array
        if (pincode) {
            const pinStr = String(pincode);
            query.$or = [
                { pincode: Number(pincode) },
                { "serviceAreas.pincode": pinStr }
            ];
        }

        const providers = await Provider.find(query)
            .select("ownerName businessName phone primaryService area city pincode experience description emergencyAvailability workingHours workingDays profilePhoto serviceAreas isAvailable rating")
            .populate("primaryService", "name")
            .sort({ experience: -1 });

        return res.status(200).json({
            success: true,
            count: providers.length,
            data: providers,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Provider: get and update own availability / service areas
router.get("/my/availability", protect, getMyAvailability);
router.patch("/my/availability", protect, updateServiceAreas);

// Admin: Monitor all availability
router.get("/admin/availability-monitor", getProviderAvailabilityMonitor);

// Admin/Shared CRUD
router.get("/", getAllProviders);
router.get("/:id", getProviderProfile);
router.put(
    "/profile/:id",
    upload.fields([
        { name: "profilePhoto", maxCount: 1 },
        { name: "certification", maxCount: 1 },
        { name: "idImage", maxCount: 1 },
        { name: "documents", maxCount: 5 }
    ]),
    updateProviderProfile
);
router.patch("/status/:id", updateProviderStatus);
router.delete("/:id", deleteProvider);

export default router;