import mongoose, { Document, Schema, Model } from "mongoose";

export interface IUser {
  _id?: any;
  name: string;
  email: string;
  password?: string;
  role: "user" | "customer" | "admin";
  refreshToken: string | null;
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
});

const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default User;
