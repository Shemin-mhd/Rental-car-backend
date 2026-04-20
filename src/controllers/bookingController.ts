import { Request, Response } from "express";
import Booking from "../models/bookings";
import Car from "../models/cars";
import User from "../models/users";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary";
import fs from "fs";
import path from "path";

// 🚗 Helper: Upload to Cloudinary
const uploadToCloudinary = async (filePath: string) => {
    try {
        // Fallback to local storage if Cloudinary is not configured
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
            console.warn("[UPLOAD] Cloudinary credentials missing. Persisting file locally fallback.");
            return path.basename(filePath);
        }

        const result = await cloudinary.uploader.upload(filePath, {
            folder: "elite-documents",
        });

        // Only delete local file if Cloudinary upload succeeded
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return result.secure_url;
    } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        // Fallback to local storage on error
        return path.basename(filePath);
    }
};

// Handler for creating a booking (used by User in confirmation page)
export const createBooking = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { carId, startDate, endDate, fullName, nomineeName, primaryPhone, secondaryPhone, address } = req.body;

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        // 🚀 Upload ID Proofs to Cloudinary
        let idFront = "";
        let idBack = "";

        if (files?.idFront?.[0]) {
            const uploadedUrl = await uploadToCloudinary(files.idFront[0].path);
            if (uploadedUrl) idFront = uploadedUrl;
        }

        if (files?.idBack?.[0]) {
            const uploadedUrl = await uploadToCloudinary(files.idBack[0].path);
            if (uploadedUrl) idBack = uploadedUrl;
        }

        if (!idFront || !idBack) {
            return res.status(400).json({ message: "Both Front and Back ID proofs are required" });
        }

        const car = await Car.findById(carId);
        if (!car) return res.status(404).json({ message: "Car not found" });

        // 🔱 Consolidate: Update User Profile with these documents
        const user = await User.findById(userId);
        if (user) {
            user.licenseFrontUrl = idFront;
            user.licenseBackUrl = idBack;
            user.verificationStatus = "PENDING";
            await user.save();
        }

        const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)));
        const totalPrice = car.pricePerDay * days;

        const newBooking = new Booking({
            carId,
            userId,
            startDate,
            endDate,
            totalPrice,
            fullName,
            nomineeName,
            primaryPhone,
            secondaryPhone,
            address,
            idFront,
            idBack,
            status: "Pending", // Pending payment
            documentStatus: "Pending", // Pending admin approval
            pickupLocation: car.location || ""
        });

        await newBooking.save();

        // 🔱 Real-time Admin Notification
        const io = (global as any).io;
        if (io) {
            io.to("admin-channel").emit("newBookingSubmitted", {
                bookingId: newBooking._id,
                fullName: newBooking.fullName,
                carName: (newBooking as any).carId?.name || "Premium Rental"
            });
            console.log("Admin Alert Emitted: New Booking Submission! 📢");
        }

        res.status(201).json({ message: "Booking initialized and documents submitted", bookingId: newBooking._id });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Handler for simulating payment success and confirming booking
export const confirmPayment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // 🚨 CRITICAL: Ensure Admin has approved documents before payment
        if (booking.documentStatus !== "Approved") {
            return res.status(403).json({ message: "Documents must be approved by Admin before payment can be processed" });
        }

        booking.status = "Confirmed";
        await booking.save();

        // 🔱 Elite Fleet Update: Mark car as Booked
        await Car.findByIdAndUpdate(booking.carId, {
            isAvailable: false,
            availableFrom: booking.endDate
        });

        res.json({ message: "Payment successful, booking confirmed", booking });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Getting a single booking by ID (used for checking status and payment page)
export const getBooking = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id).populate("carId");

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        res.json(booking);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🔱 Admin: Get all bookings with pending documents
export const getPendingDocuments = async (req: Request, res: Response) => {
    try {
        const bookings = await Booking.find({ documentStatus: "Pending" })
            .populate("carId", "name model")
            .populate("userId", "name email");

        res.json(bookings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🔱 Admin: Approve or Reject Document
export const updateDocumentStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // "Approved" or "Rejected"

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const booking = await Booking.findById(id);
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        booking.documentStatus = status;

        // If rejected, we might also want to cancel the booking
        if (status === "Rejected") {
            booking.status = "Cancelled";
        }

        await booking.save();

        // 🛰️ Real-time Sync-Bridge
        const io = (global as any).io;
        if (io) {
            const roomId = id.toString();
            io.to(roomId).emit("bookingStatusUpdate", {
                bookingId: roomId,
                documentStatus: status,
                status: booking.status
            });
            console.log(`[SYNC-BRIDGE] Dossier Authorized: ${roomId} -> ${status} ⚡`);
        }

        res.json({ message: `Document ${status.toLowerCase()} successfully`, booking });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🚗 User: Get all personal bookings
export const getUserBookings = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const bookings = await Booking.find({ userId }).populate("carId").sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
// 🚗 User: Decommission/Delete own Pending booking
export const deleteBooking = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        const booking = await Booking.findOne({ _id: id, userId });
        if (!booking) return res.status(404).json({ message: "Booking dossier not found" });

        // Security: Prevent deleting confirmed bookings via this route
        if (booking.status === "Confirmed") {
            return res.status(403).json({ message: "Hyper-Transaction already authorized. Access Admin for cancellation." });
        }

        await Booking.findByIdAndDelete(id);
        res.json({ message: "Reservation scrubbed from active registry 🛡️" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// ?? Admin: Void Transaction - Delete ANY booking
export const adminDeleteBooking = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await Booking.findByIdAndDelete(id);
        res.json({ message: 'Transaction voided and scrubbed ???' });
    } catch (error) {
        res.status(500).json({ message: 'Error voiding transaction' });
    }
};

// 🚗 User: Mark as Arrived at Pickup
export const markArrived = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        const booking = await Booking.findOne({ _id: id, userId }).populate("carId", "name ownerId");
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        const allowedStatuses = ["Confirmed", "upcoming_pickup"];
        if (!allowedStatuses.includes(booking.status)) {
            return res.status(400).json({ message: `Cannot mark arrival for booking with status: ${booking.status}` });
        }

        booking.status = "arrived";
        await booking.save();

        // 🛰️ Notify host in real-time
        const io = (global as any).io;
        const car = booking.carId as any;
        if (io && car?.ownerId) {
            io.to(`user-${car.ownerId.toString()}`).emit("customerArrived", {
                bookingId: id,
                message: `Customer has arrived for pickup of ${car.name}`,
                fullName: booking.fullName,
            });
        }
        // Also emit to booking room for real-time status update on user side
        if (io) {
            io.to(id).emit("bookingStatusUpdate", { bookingId: id, status: "arrived" });
        }

        res.json({ message: "Arrival confirmed. Host has been notified.", status: "arrived" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🔑 Host: Confirm Car Handover → start the trip
export const markHandedOver = async (req: Request, res: Response) => {
    try {
        const hostId = (req as any).user.id;
        const { id } = req.params;

        // Find the booking and make sure the car belongs to this host
        const booking = await Booking.findById(id).populate("carId", "name ownerId");
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        const car = booking.carId as any;
        if (car?.ownerId?.toString() !== hostId) {
            return res.status(403).json({ message: "You are not the owner of this car" });
        }

        if (booking.status !== "arrived") {
            return res.status(400).json({ message: `Car can only be handed over when customer has arrived. Current status: ${booking.status}` });
        }

        booking.status = "active_trip";
        await booking.save();

        // 🛰️ Notify user in real-time
        const io = (global as any).io;
        if (io) {
            io.to(`user-${booking.userId.toString()}`).emit("tripStarted", {
                bookingId: id,
                message: `Your trip has started! Enjoy the drive — ${car.name} is yours.`,
            });
            // Emit to booking room too
            io.to(id).emit("bookingStatusUpdate", { bookingId: id, status: "active_trip" });
        }

        res.json({ message: "Car handed over. Trip is now active.", status: "active_trip" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🔱 Host: Get bookings for cars owned by this host
export const getHostBookings = async (req: Request, res: Response) => {
    try {
        const hostId = (req as any).user.id;
        const Car = require("../models/cars").default;
        const hostCars = await Car.find({ ownerId: hostId }).select("_id");
        const carIds = hostCars.map((c: any) => c._id);

        const bookings = await Booking.find({ carId: { $in: carIds } })
            .populate("carId", "name model image location")
            .populate("userId", "name email")
            .sort({ createdAt: -1 });

        res.json(bookings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🛰️ Telemetry Uplink: Handles real-time location pulses from units
export const updateLocation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { lat, lng, speed } = req.body;

        const booking = await Booking.findById(id);
        if (!booking) return res.status(404).json({ message: "Mission record not found." });

        // 🔱 Update Asset Position in tactical registry
        await Car.findByIdAndUpdate(booking.carId, {
            lat,
            lng,
            availableFrom: new Date() // Keeps car "active" in registry
        });

        // 🛰️ Broadcast to Operational Theater (Intercept Page)
        const io = (global as any).io;
        if (io) {
            io.to(`mission-${id}`).emit("locationUpdate", {
                lat,
                lng,
                speed: speed || 0,
                timestamp: new Date()
            });
        }

        res.json({ message: "Telemetry Link Stable", status: "Synchronized" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
// 🔱 Admin: Full Override - Change Booking Status
export const patchBookingStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const booking = await Booking.findById(id);
        if (!booking) return res.status(404).json({ message: "Booking dossier not found" });

        booking.status = status;
        await booking.save();

        // 🛰️ Real-time Status Sync
        const io = (global as any).io;
        if (io) {
            io.to(id).emit("bookingStatusUpdate", { bookingId: id, status });
        }

        res.json({ message: "Hyper-Transaction status overridden", status });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🔱 Admin: Apply Manual Fine (Damages, Cleaning, etc.)
export const applyManualFine = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;

        const booking = await Booking.findById(id);
        if (!booking) return res.status(404).json({ message: "Booking record not found" });

        booking.lateFine = (booking.lateFine || 0) + Number(amount);
        await booking.save();

        res.json({ 
            message: `Manual Penalty of ₹${amount} applied. Total Fines: ₹${booking.lateFine}`,
            totalFine: booking.lateFine 
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 💳 User: Initiate fine payment (Razorpay Order)
export const initiateFinePayment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);
        if (!booking || !booking.lateFine) return res.status(404).json({ message: "No fine found for this mission" });

        const instance = (global as any).razorpay;
        if (!instance) return res.status(500).json({ message: "Razorpay node offline" });

        const order = await instance.orders.create({
            amount: booking.lateFine * 100,
            currency: "INR",
            receipt: `fine_rect_${id.slice(-6)}`,
        });

        booking.fineRazorpayOrderId = order.id;
        await booking.save();

        res.json({ orderId: order.id, amount: booking.lateFine, currency: "INR" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 💳 User: Confirm fine payment success
export const confirmFinePayment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { paymentId } = req.body;

        const booking = await Booking.findById(id);
        if (!booking) return res.status(404).json({ message: "Record lost" });

        booking.finePaid = true;
        await booking.save();

        res.json({ message: "Fine settled. Legal status: CLEAR.", finePaid: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
