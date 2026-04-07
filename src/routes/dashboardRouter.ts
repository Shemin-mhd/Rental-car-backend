import express, { Request, Response } from "express";
import { authenticate, authorizeRole } from "../middleware/authMiddleware";

const router = express.Router();

// 🔱 Admin Only
router.get("/admin", authenticate, authorizeRole("admin"), (req: Request, res: Response) => {
    res.json({ message: "Welcome to the Admin Secure Vault", stats: { users: 1540, revenue: 95000 } });
});

// 🏎️ Customer (Hosts) Only
router.get("/customer", authenticate, authorizeRole("customer"), (req: Request, res: Response) => {
    res.json({ message: "Host Fleet Terminal", fleetCount: 12 });
});

// 👤 Regular Users Only
router.get("/user", authenticate, authorizeRole("user"), (req: Request, res: Response) => {
    res.json({ message: "Personal Rental History", activeTrips: 1 });
});

export default router;
