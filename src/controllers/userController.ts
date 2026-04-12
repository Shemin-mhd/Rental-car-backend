import { Request, Response } from "express";
import User from "../models/users";
import cloudinary from "../config/cloudinary";
import fs from "fs";
import path from "path";

const uploadToCloudinary = async (filePath: string) => {
    try {
        if (!process.env.CLOUDINARY_CLOUD_NAME) return path.basename(filePath);
        const result = await cloudinary.uploader.upload(filePath, { folder: "user-identities" });
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return result.secure_url;
    } catch (error) {
        console.error("Upload Error:", error);
        return path.basename(filePath);
    }
};

export const uploadUserDocs = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        if (!files.licenseFront?.[0] || !files.licenseBack?.[0]) {
            return res.status(400).json({ message: "Both License FRONT and BACK images are mandatory for verification." });
        }

        const licenseFrontUrl = await uploadToCloudinary(files.licenseFront[0].path);
        const licenseBackUrl = await uploadToCloudinary(files.licenseBack[0].path);

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.licenseFrontUrl = licenseFrontUrl;
        user.licenseBackUrl = licenseBackUrl;
        user.verificationStatus = "PENDING";
        user.rejectionReason = ""; // Clear reason on re-upload

        await user.save();
        res.json({ message: "Documents submitted for verification.", user });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getUserStatus = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const user = await User.findById(userId).select("verificationStatus rejectionReason aadhaarCardUrl drivingLicenseUrl");
        res.json(user);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
