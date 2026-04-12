import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  text?: string;
  image?: string;
  messageType: "text" | "image" | "system";
  isSeen: boolean;
  deliveredAt?: Date;
  seenAt?: Date;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema(
  {
    chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String },
    image: { type: String },
    messageType: { type: String, enum: ["text", "image", "system"], default: "text" },
    isSeen: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    seenAt: { type: Date }
  },
  { timestamps: true }
);

// Add index for fast retrieval of chat messages
MessageSchema.index({ chatId: 1, createdAt: -1 });

export default mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
