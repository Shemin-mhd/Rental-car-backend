import express, { Request, Response, NextFunction } from "express";
import { register, login, refreshToken, logout, googleAuthCallback } from "../controllers/authController";
import { uploadUserDocs, getUserStatus } from "../controllers/userController";
import User from "../models/users";
import bcrypt from "bcryptjs";
import { authenticate } from "../middleware/authMiddleware";
import passport from "../config/passport";
import multer from "multer";
import path from "path";

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, "user-" + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });
const userDocUpload = upload.fields([
    { name: "licenseFront", maxCount: 1 },
    { name: "licenseBack", maxCount: 1 }
]);

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", authenticate, logout);

// Identity Verification
router.get("/status", authenticate, getUserStatus);
router.post("/upload-docs", authenticate, userDocUpload, uploadUserDocs);

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
