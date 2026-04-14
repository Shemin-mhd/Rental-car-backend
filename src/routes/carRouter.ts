import express from "express";
import { getCars, getCarById, addCar, updateCar, deleteCar, getOwnerCars } from "../controllers/carController";
import { authenticate, authorizeRole } from "../middleware/authMiddleware";
import multer from "multer";
import path from "path";

const router = express.Router();

// Setup multer for car images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "car-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });
const carUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "gallery", maxCount: 4 },
  { name: "rcFront", maxCount: 1 },
  { name: "rcBack", maxCount: 1 }
]);

// 🚗 Fetch Car Listings
router.get("/", getCars);

// 🚗 Fetch Single Car Details
router.get("/:id", getCarById);

// 🚗 Host/Customer: Fleet Management
router.get("/owner/cars", authenticate, authorizeRole("customer"), getOwnerCars);
router.post("/host/listing", authenticate, authorizeRole("customer"), carUpload, addCar);

// 🔱 Admin/Customer: Manage Global Fleet
router.post("/", authenticate, authorizeRole("admin"), carUpload, addCar);
router.put("/:id", authenticate, authorizeRole("admin", "customer"), carUpload, updateCar);
router.patch("/:id", authenticate, authorizeRole("admin", "customer"), carUpload, updateCar);
router.delete("/:id", authenticate, authorizeRole("admin", "customer"), deleteCar);

export default router;
