import express from "express";
import authRouter from "./authRouter";
import dashboardRouter from "./dashboardRouter";
import carRouter from "./carRouter";
import bookingRouter from "./bookingRouter";
import paymentRouter from "./paymentRouter";
import chatRouter from "./chatRouter";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/dashboard", dashboardRouter);
router.use("/cars", carRouter);
router.use("/bookings", bookingRouter);
router.use("/payments", paymentRouter);
router.use("/chat", chatRouter);

export default router;
