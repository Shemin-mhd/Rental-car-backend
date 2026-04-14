import express from "express";
import multer from "multer";
import path from "path";
import { authenticate, authorizeRole } from "../middleware/authMiddleware";
import {
  createBooking,
  confirmPayment,
  getPendingDocuments,
  updateDocumentStatus,
  getBooking,
  getUserBookings,
  deleteBooking,
  adminDeleteBooking,
  markArrived,
  markHandedOver,
  getHostBookings,
  updateLocation,
} from "../controllers/bookingController";

import { updateTripStatus } from "../controllers/tripController";

const router = express.Router();

// 🚗 User: Fetch their booking history
router.get("/user/bookings", authenticate, getUserBookings);

// 🔱 Host: Get bookings for their cars
router.get("/host/bookings", authenticate, getHostBookings);

// 🔱 Admin: All pending documents
router.get("/documents/pending", authenticate, authorizeRole("admin"), getPendingDocuments);

// Setup multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "doc-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// 📝 User creates a booking (uploads documents)
router.post(
  "/",
  authenticate,
  upload.fields([{ name: "idFront" }, { name: "idBack" }]),
  createBooking
);

// 💳 User confirms payment for an existing booking
router.post("/:id/payment", authenticate, confirmPayment);

// 🔍 Fetch one booking by ID (used by payment page + detail page)
router.get("/:id", getBooking);

// 🔱 Admin approves or rejects a document
router.patch("/:id/document-status", authenticate, authorizeRole("admin"), updateDocumentStatus);

// 🔱 Admin/Host: Update mission status (Complete trip)
router.patch("/:id/trip-status", authenticate, updateTripStatus);

// 🚗 User: Mark arrival at pickup location → status = arrived
router.patch("/:id/arrived", authenticate, markArrived);

// 🔑 Host/Admin: Confirm car handed over → status = active_trip
router.patch("/:id/handover", authenticate, markHandedOver);
 
// 📡 Unit/Simulation: Send live telemetry pulse
router.post("/:id/location", authenticate, updateLocation);

// 🗑️ User: Cancel/delete own Pending booking
router.delete("/:id", authenticate, deleteBooking);

// 🔱 Admin: Void a transaction
router.delete("/admin/:id", authenticate, authorizeRole("admin"), adminDeleteBooking);

export default router;
