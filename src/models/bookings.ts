import mongoose, { Document, Schema, Model } from "mongoose";

export interface IBooking {
    carId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    totalPrice: number;
    status: "Pending" | "Confirmed" | "Cancelled" | "Completed";
    
    bookingType: "self" | "driver";
    fullName: string;
    nomineeName: string;
    primaryPhone: string;
    secondaryPhone: string;
    address: string;
    idFront: string;
    idBack: string;
    documentStatus: "Pending" | "Approved" | "Rejected";
    razorpayPaymentId?: string;
    razorpayOrderId?: string;

    createdAt: Date;
}

const bookingSchema: Schema<IBooking> = new mongoose.Schema({
    carId: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalPrice: { type: Number, required: true },
    status: { type: String, enum: ["Pending", "Confirmed", "Cancelled", "Completed"], default: "Pending" },
    
    bookingType: { type: String, enum: ["self", "driver"], default: "self" },
    fullName: { type: String, required: true },
    nomineeName: { type: String, required: true },
    primaryPhone: { type: String, required: true },
    secondaryPhone: { type: String },
    address: { type: String, required: true },
    idFront: { type: String },
    idBack: { type: String },
    documentStatus: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String },

    createdAt: { type: Date, default: Date.now },
});

const Booking: Model<IBooking> = mongoose.model<IBooking>("Booking", bookingSchema);
export default Booking;
