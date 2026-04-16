import express from "express";
import { loginUser, registerUser, logoutUser, getMe, assignAdminRole, getAllUsers, updatePassword, getAddresses, addAddress, updateAddress, deleteAddress } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", registerUser);
router.post("/login", loginUser);
router.post("/assign-admin", assignAdminRole);
router.get("/users", getAllUsers);
router.get("/me", protect, getMe);
router.post("/logout", logoutUser);
router.patch("/update-password", protect, updatePassword);

// Address management routes
router.get("/addresses", protect, getAddresses);
router.post("/addresses", protect, addAddress);
router.patch("/addresses/:addressId", protect, updateAddress);
router.delete("/addresses/:addressId", protect, deleteAddress);

router.get("/me", protect, getMe);        // ✅ GET /api/auth/me
router.post("/logout", protect, logoutUser); // ✅ POST /api/auth/logout

export default router;