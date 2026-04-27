import express from "express";
import {
    createService,
    getAllServices,
    getServiceById,
    updateService,
    deleteService,
} from "../controllers/serviceController.js";
import { upload } from "../utils/multerConfig.js";

const router = express.Router();

router.post("/", upload.single("image"), createService);
router.get("/", getAllServices);
router.get("/:id", getServiceById);
router.put("/:id", upload.single("image"), updateService);
router.delete("/:id", deleteService);

export default router;
