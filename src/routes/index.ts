import express from "express";
import authRouter from "./authRouter";
import dashboardRouter from "./dashboardRouter";
import carRouter from "./carRouter";
import bookingRouter from "./bookingRouter";
import paymentRouter from "./paymentRouter";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/dashboard", dashboardRouter);
router.use("/cars", carRouter);
router.use("/bookings", bookingRouter);
router.use("/payments", paymentRouter);

export default router;
