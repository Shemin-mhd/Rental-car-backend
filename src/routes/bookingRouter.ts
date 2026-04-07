import express from "express";
import multer from "multer";
import path from "path";
import { authenticate, authorizeRole } from "../middleware/authMiddleware";
import { createBooking, confirmPayment, getPendingDocuments, updateDocumentStatus, getBooking, getUserBookings, deleteBooking } from "../controllers/bookingController";

const router = express.Router();

// 🚗 User: Fetch their booking history
router.get("/user/bookings", authenticate, getUserBookings);

// 🗑️ User: Decommission/Delete own Pending booking
router.delete("/:id", authenticate, deleteBooking);

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

// 🔍 Fetch booking (public access for payment link)
router.get("/:id", getBooking);

// 🔱 Admin gets all pending documents
router.get("/documents/pending", authenticate, authorizeRole("admin"), getPendingDocuments);

// 🔱 Admin approves or rejects a document
router.patch("/:id/document-status", authenticate, authorizeRole("admin"), updateDocumentStatus);

export default router;
