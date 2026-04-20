import mongoose, { Document, Schema, Model } from "mongoose";

export interface IUser {
  _id?: any;
  name: string;
  email: string;
  password?: string;
  role: "user" | "customer" | "admin";
  refreshToken: string | null;
  licenseFrontUrl?: string;
  licenseBackUrl?: string;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  isBlocked?: boolean;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: false,
  },
  role: {
    type: String,
    enum: ["user", "customer", "admin"],
    default: "user",
  },
  refreshToken: {
    type: String,
    default: null,
  },
  licenseFrontUrl: { type: String, default: "" },
  licenseBackUrl: { type: String, default: "" },
  verificationStatus: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED"],
    default: "PENDING"
  },
  rejectionReason: { type: String, default: "" },
  isBlocked: { type: Boolean, default: false },
});

const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default User;
