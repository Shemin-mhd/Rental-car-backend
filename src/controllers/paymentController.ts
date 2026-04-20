import { Request, Response } from "express";
import Razorpay from "razorpay";
import Booking from "../models/bookings";
import Car from "../models/cars";
import dotenv from "dotenv";

dotenv.config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

// ✅ Export for use in other controllers (like Fine Payments)
(global as any).razorpay = razorpay;

export const createRazorpayOrder = async (req: Request, res: Response) => {
    try {
        const { bookingId } = req.body;

        const booking = await Booking.findById(bookingId).populate("carId");
        if (!booking) {
            return res.status(404).json({ message: "Booking dossier not found" });
        }

        // Razorpay expects amount in PAISE (₹1 = 100 paise)
        const amountInPaise = booking.totalPrice * 100;

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `rcpt_${bookingId}`,
            notes: {
                bookingId: bookingId.toString(),
                carName: (booking.carId as any).name
            }
        };

        const order = await razorpay.orders.create(options);

        res.status(201).json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID // Sending key to frontend for the popup
        });

    } catch (error: any) {
        console.error("🔱 RAZORPAY CRITICAL ERROR:", error);

        // Deep-scan for Razorpay's specific error description
        const detailedError = error.error?.description || error.message || "Unknown Gateway Error";

        res.status(500).json({
            message: `Razorpay rejected the uplink: ${detailedError}`,
            technicalDetails: error
        });
    }
};

export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { bookingId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        // In production, you MUST verify the signature here using crypto
        // For development, we will mark the booking as confirmed upon receiving payment details

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: "Archive not found" });
        }

        booking.status = "Confirmed";
        booking.razorpayPaymentId = razorpay_payment_id;
        booking.razorpayOrderId = razorpay_order_id;
        await booking.save();

        // 🔱 Elite Fleet Update: Mark car as Booked
        await Car.findByIdAndUpdate(booking.carId, { 
            isAvailable: false,
            availableFrom: booking.endDate
        });

        res.json({ message: "Transaction authorized. Fleet access granted.", status: "Confirmed" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
