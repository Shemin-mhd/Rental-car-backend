import mongoose, { Document, Schema, Model } from "mongoose";

export interface ICar {
  name: string;
  model: string;
  year: number;
  pricePerDay: number;
  seats: number;
  transmission: "Manual" | "Auto";
  location: string;
  category: "All" | "Wedding" | "Luxury" | "Family" | "SUV" | "Vintage";
  image: string;
  gallery?: string[];
  selfDrive: boolean;
  withDriver: boolean;
  isAvailable: boolean;
  rating: number;
  ownerId?: mongoose.Schema.Types.ObjectId;
  specifications: {
    fuelType: string;
    engine: string;
    hp: number;
    topSpeed: number;
    acceleration: string;
  };
  description?: string;
  features?: string[];
  rcFrontUrl?: string;
  rcBackUrl?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
}

const carSchema: Schema<ICar> = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  pricePerDay: {
    type: Number,
    required: true,
  },
  seats: {
    type: Number,
    required: true,
  },
  transmission: {
    type: String,
    enum: ["Manual", "Auto"],
    default: "Auto",
  },
  location: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ["All", "Wedding", "Luxury", "Family", "SUV", "Vintage"],
    default: "Luxury",
  },
  image: {
    type: String,
    required: true,
  },
  gallery: {
    type: [String],
    default: [],
  },
  selfDrive: {
    type: Boolean,
    default: true,
  },
  withDriver: {
    type: Boolean,
    default: true,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  rating: {
    type: Number,
    default: 4.5,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  specifications: {
    fuelType: { type: String, default: "Petrol" },
    engine: { type: String },
    hp: { type: Number },
    topSpeed: { type: Number },
    acceleration: { type: String }
  },
  description: { type: String },
  features: { type: [String], default: [] },
  rcFrontUrl: { type: String, default: "" },
  rcBackUrl: { type: String, default: "" },
  status: { 
    type: String, 
    enum: ["PENDING", "APPROVED", "REJECTED"], 
    default: "PENDING" 
  },
  rejectionReason: { type: String, default: "" }
});

const Car: Model<ICar> = mongoose.model<ICar>("Car", carSchema);
export default Car;
