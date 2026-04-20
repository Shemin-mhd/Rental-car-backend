import mongoose, { Schema, Document } from "mongoose";

export interface IChat extends Document {
  bookingId: mongoose.Types.ObjectId;
  renterId: mongoose.Types.ObjectId;
  hostId: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  status: "active" | "completed" | "blocked";
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: Map<string, number>; // Map of userId to unread count
}

const ChatSchema: Schema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    carId: { type: Schema.Types.ObjectId, ref: "Car" },
    renterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["active", "completed", "blocked"], default: "active" },
    lastMessage: { type: String },
    lastMessageAt: { type: Date, default: Date.now },
    unreadCount: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  { timestamps: true }
);

export default mongoose.models.Chat || mongoose.model<IChat>("Chat", ChatSchema);
