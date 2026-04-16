import express from "express";
import { addToCart, getCart, removeFromCart, clearCart } from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/add", addToCart);
router.get("/:userId", getCart); // Using params for userId for now (typically from middleware)
router.post("/remove", removeFromCart); // Using POST for remove to send body easily
router.delete("/clear", clearCart);

export default router;
