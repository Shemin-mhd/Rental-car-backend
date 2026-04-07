import { Request, Response } from "express";
import Car from "../models/cars";
import Booking from "../models/bookings";

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

// 🔱 Admin: Add New Car
export const addCar = async (req: Request, res: Response) => {
    try {
        const { name, model, year, pricePerDay, seats, transmission, location, category, selfDrive, withDriver, ownerId, fuelType, engine, hp, topSpeed, acceleration, description, features } = req.body;

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const image = files?.['image']?.[0]?.filename;
        const gallery = files?.['gallery']?.map(f => f.filename) || [];

        const parsedFeatures = typeof features === "string" ? JSON.parse(features) : features;

        if (!image) return res.status(400).json({ message: "Vehicle high-definition image is required for catalog" });

        // If ownerId is provided in body (Admin action) use it, otherwise use current user (Customer action)
        const finalOwnerId = ownerId || (req as any).user?.id;

        const newCar = new Car({
            name, model, year, pricePerDay, seats, transmission, location, category, selfDrive, withDriver, image, gallery, ownerId: finalOwnerId,
            description,
            features: parsedFeatures,
            specifications: {
                fuelType, engine, hp, topSpeed, acceleration
            }
        });

        await newCar.save();
        res.status(201).json({ message: "Elite Vehicle Commissioned Successfully!", car: newCar });
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
        if (files?.['image']?.[0]) {
            updateData.image = files['image'][0].filename;
        }
        if (files?.['gallery']) {
            updateData.gallery = files['gallery'].map(f => f.filename);
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
