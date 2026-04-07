import express, { Request, Response, NextFunction } from "express";
import { register, login, refreshToken, logout, googleAuthCallback } from "../controllers/authController";
import User from "../models/users";
import bcrypt from "bcryptjs";
import { authenticate } from "../middleware/authMiddleware";
import passport from "../config/passport";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", authenticate, logout);

// 🔱 Google OAuth Routes
router.get("/google", (req: Request, res: Response, next: NextFunction) => {
    const role = (req.query.role as string) || "user";
    const redirect = (req.query.redirect as string) || "";
    
    // Combine role and redirect in state (Role:Redirect)
    const state = `${role}:${redirect}`;

    (passport as any).authenticate("google", { 
        scope: ["profile", "email"], 
        session: false,
        state: state 
    })(req, res, next); 
});

router.get("/google/callback", (req, res, next) => {
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3005";
    passport.authenticate("google", { 
        session: false, 
        failureRedirect: `${FRONTEND_URL}/login?error=Google auth failed` 
    })(req, res, next);
}, googleAuthCallback);



// 🔱 One-time Admin Seed Script
// Visit: POST http://localhost:5000/api/auth/seed-admin
router.post("/seed-admin", async (req, res) => {
    try {
        const existingAdmin = await User.findOne({ email: "admin@rentalgarage.com" });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin already exists!" });
        }

        const hashedPassword = await bcrypt.hash("admin123", 10);
        const admin = new User({
            name: "Super Admin",
            email: "admin@rentalgarage.com",
            password: hashedPassword,
            role: "admin",
        });

        await admin.save();
        res.json({ message: "Admin seeded successfully!", email: "admin@rentalgarage.com", password: "admin123" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
