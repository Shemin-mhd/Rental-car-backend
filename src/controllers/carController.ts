import { Request, Response } from "express";
import Car from "../models/cars";
import Booking from "../models/bookings";
import cloudinary from "../config/cloudinary";
import fs from "fs";

// 🚗 Get All Cars (with advanced filtering)
export const getCars = async (req: Request, res: Response) => {
    try {
        const { category, location, type }: any = req.query; // type can be 'self' or 'driver'
        const filter: any = {};

        if (category && category !== "All") filter.category = category;
        if (location && location !== "All") filter.location = new RegExp(location, "i");

        // Handle Booking Type (Self Drive vs With Driver)
        if (type === "self") filter.selfDrive = true;
        if (type === "driver") filter.withDriver = true;

        // Handle Date-Based Availability Filtering
        const { start, end }: any = req.query;
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);

            // 1. Find all bookings that overlap with the selected range
            const overlappingBookings = await Booking.find({
                status: { $ne: "Cancelled" }, // Ignore cancelled bookings
                $or: [
                    { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
                ]
            }).select("carId");

            const bookedCarIds = overlappingBookings.map(b => b.carId);

            // 2. Exclude those cars from the search
            filter._id = { $nin: bookedCarIds };
        }

        // 🚨 CRITICAL: Only show Admin-approved vehicles
        filter.status = "APPROVED";

        const cars = await Car.find(filter);
        res.json(cars);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🚗 Get Owner Specific Cars (Customer/Partner Fleet)
export const getOwnerCars = async (req: Request, res: Response) => {
    try {
        const ownerId = (req as any).user.id;
        const cars = await Car.find({ ownerId });
        res.json(cars);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🚗 Get Single Car by ID
export const getCarById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const car = await Car.findById(id);
        if (!car) {
            return res.status(404).json({ message: "Car not found" });
        }
        res.json(car);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🚗 Helper: Upload to Cloudinary with Local Fallback
const uploadToCloudinary = async (file: Express.Multer.File) => {
    try {
        // If Cloudinary is not configured, skip and use local path
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.warn("Cloudinary not configured. Using local fallback.");
            return file.filename;
        }

        const result = await cloudinary.uploader.upload(file.path, {
            folder: "elite-fleet",
        });
        // Delete local file after upload to Cloudinary
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return result.secure_url;
    } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        // Fallback to local filename if upload fails
        return file.filename;
    }
};

// 🔱 Admin/Host: Add New Car
export const addCar = async (req: Request, res: Response) => {
    try {
        const { name, model, year, pricePerDay, seats, transmission, location, category, selfDrive, withDriver, ownerId, fuelType, engine, hp, topSpeed, acceleration, description, features } = req.body;
        
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        let mainImage = "";
        let galleryUrls: string[] = [];
        let rcFrontUrl = "";
        let rcBackUrl = "";

        // 🖼️ Process Images
        if (files?.image?.[0]) {
            mainImage = await uploadToCloudinary(files.image[0]);
        }
        if (files?.gallery) {
            for (const file of files.gallery) {
                const url = await uploadToCloudinary(file);
                galleryUrls.push(url);
            }
        }

        // 🛡️ Process Documents
        if (files?.rcFront?.[0]) rcFrontUrl = await uploadToCloudinary(files.rcFront[0]);
        if (files?.rcBack?.[0]) rcBackUrl = await uploadToCloudinary(files.rcBack[0]);

        if (!mainImage) return res.status(400).json({ message: "Primary car image is mandatory" });
        if (!rcFrontUrl || !rcBackUrl) return res.status(400).json({ message: "Both RC Book FRONT and BACK images are mandatory" });

        const newCar = new Car({
            name,
            model,
            year,
            pricePerDay,
            seats,
            transmission,
            location,
            category,
            image: mainImage,
            gallery: galleryUrls,
            selfDrive: selfDrive === "true",
            withDriver: withDriver === "true",
            ownerId: ownerId || (req as any).user.id,
            status: "PENDING", 
            rcFrontUrl,
            rcBackUrl,
            specifications: { fuelType, engine, hp, topSpeed, acceleration },
            description,
            features: JSON.parse(features || "[]")
        });

        await newCar.save();
        res.status(201).json({ message: "Car listed and pending registration audit 🔱", car: newCar });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🔱 Admin/Customer: Update Car Details
export const updateCar = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { role, id: userId } = (req as any).user;
        const { fuelType, engine, hp, topSpeed, acceleration, features, ...updateData } = req.body;

        const car = await Car.findById(id);
        if (!car) return res.status(404).json({ message: "Vehicle entry not found" });

        // Security Pass: Check if user is Admin OR the specific Owner
        if (role !== "admin" && car.ownerId?.toString() !== userId) {
            return res.status(403).json({ message: "Fleet authority denied. Unauthorized modification protocol." });
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        // 🚀 Update Primary Image on Cloudinary
        if (files?.['image']?.[0]) {
            const uploadedUrl = await uploadToCloudinary(files['image'][0]);
            if (uploadedUrl) updateData.image = uploadedUrl;
        }

        // 🚀 Update Gallery Images on Cloudinary
        if (files?.['gallery']) {
            const gallery: string[] = [];
            for (const file of files['gallery']) {
                const uploadedUrl = await uploadToCloudinary(file);
                if (uploadedUrl) gallery.push(uploadedUrl);
            }
            updateData.gallery = gallery;
        }

        if (features) {
            updateData.features = typeof features === "string" ? JSON.parse(features) : features;
        }

        // Deep Merge Specifications
        if (fuelType || engine || hp || topSpeed || acceleration) {
            updateData.specifications = {
                ...car.specifications,
                ...(fuelType && { fuelType }),
                ...(engine && { engine }),
                ...(hp && { hp }),
                ...(topSpeed && { topSpeed }),
                ...(acceleration && { acceleration })
            };
        }

        const updatedCar = await Car.findByIdAndUpdate(id, updateData, { new: true });
        res.json({ message: "Fleet Specifications Updated 🧬", car: updatedCar });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🔱 Admin/Customer: Decommission Car
export const deleteCar = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { role, id: userId } = (req as any).user;

        const car = await Car.findById(id);
        if (!car) return res.status(404).json({ message: "Vehicle profile not found" });

        // Security Pass: Check if user is Admin OR the specific Owner
        if (role !== "admin" && car.ownerId?.toString() !== userId) {
            return res.status(403).json({ message: "Fleet authority denied. Unauthorized decommission protocol." });
        }

        await Car.findByIdAndDelete(id);
        res.json({ message: "Vehicle Decommissioned from Active Registry 🛡️" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
