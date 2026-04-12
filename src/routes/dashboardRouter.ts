import express, { Request, Response } from "express";
import { authenticate, authorizeRole } from "../middleware/authMiddleware";
import {
    getAdminStats,
    getCustomerStats,
    getAdminUsers,
    getAdminBookings,
    getPendingUsers,
    verifyUser,
    getPendingVehicles,
    verifyVehicle,
    getAllCars,
    deleteUser,
    deleteCar,
    updateUserRole,
    updateBookingStatusAdmin,
    toggleBlockUser
} from "../controllers/dashboardController";

const router = express.Router();

// 🔱 Admin Only
router.get("/admin", authenticate, authorizeRole("admin"), getAdminStats);
router.get("/admin/users", authenticate, authorizeRole("admin"), getAdminUsers);
router.get("/admin/bookings", authenticate, authorizeRole("admin"), getAdminBookings);
router.get("/admin/cars", authenticate, authorizeRole("admin"), getAllCars);

router.delete("/admin/users/:id", authenticate, authorizeRole("admin"), deleteUser);
router.delete("/admin/cars/:id", authenticate, authorizeRole("admin"), deleteCar);

router.patch("/admin/users/:id/role", authenticate, authorizeRole("admin"), updateUserRole);
router.patch("/admin/users/:id/block", authenticate, authorizeRole("admin"), toggleBlockUser);
router.patch("/admin/bookings/:id/status", authenticate, authorizeRole("admin"), updateBookingStatusAdmin);

// 🛡️ Verification Routes
router.get("/admin/pending-users", authenticate, authorizeRole("admin"), getPendingUsers);
router.patch("/admin/verify-user/:id", authenticate, authorizeRole("admin"), verifyUser);
router.get("/admin/pending-vehicles", authenticate, authorizeRole("admin"), getPendingVehicles);
router.patch("/admin/verify-vehicle/:id", authenticate, authorizeRole("admin"), verifyVehicle);

// 🏎️ Customer (Hosts) Only
router.get("/customer", authenticate, authorizeRole("customer"), getCustomerStats);

// 👤 Regular Users Only
router.get("/user", authenticate, authorizeRole("user"), (req: Request, res: Response) => {
    res.json({ message: "Personal Rental History", activeTrips: 1 });
});

export default router;
