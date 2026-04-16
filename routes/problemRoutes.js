
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
    createProblem,
    getProblemsByServiceId,
    getProblemById,
    updateProblem,
    deleteProblem,
    createProviderSpecialty,
    getMySpecialties,
    updateProviderSpecialty,
    deleteProviderSpecialty
} from "../controllers/problemController.js";

const router = express.Router();

router.post("/", createProblem);
router.get("/service/:serviceId", getProblemsByServiceId);

// ✅ NEW: Provider Specific Specialty Management
router.post("/my", protect, createProviderSpecialty);
router.get("/my", protect, getMySpecialties);
router.put("/my/:id", protect, updateProviderSpecialty);
router.delete("/my/:id", protect, deleteProviderSpecialty);

router.get("/:id", getProblemById);
router.put("/:id", updateProblem);
router.delete("/:id", deleteProblem);

export default router;
