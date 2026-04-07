import express from "express";
import { createRazorpayOrder, verifyPayment } from "../controllers/paymentController";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/order", createRazorpayOrder);
router.post("/verify", verifyPayment);

export default router;
