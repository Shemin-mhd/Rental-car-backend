import { Request, Response } from "express";
import Chat from "../models/chats";
import Message from "../models/messages";
import Booking from "../models/bookings";
import User from "../models/users";
import mongoose from "mongoose";

// 🔱 Create or Get existing chat for a booking
export const createOrGetChat = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.body;
    const userId = (req as any).user.id;

    console.log(`📡 [CHAT_INIT] Attempting thread synchronization for Booking: ${bookingId} by User: ${userId}`);

    // 1. Verify booking exists and user is a participant
    const booking = await Booking.findById(bookingId).populate("carId");
    if (!booking) {
      console.error(`❌ [CHAT_INIT] Booking not found: ${bookingId}`);
      return res.status(404).json({ message: "Booking protocol not found" });
    }

    const renterId = booking.userId?.toString();
    let hostId = (booking.carId as any)?.ownerId?.toString();

    // 🔱 Admin Fallback Protocol: If no owner is assigned to the car, route to the first available platform admin
    if (!hostId) {
      console.warn(`⚠️ [CHAT_INIT] Car ${booking.carId} has no owner. Searching for system admin fallback...`);
      const admin = await User.findOne({ role: "admin" });
      if (admin) {
        hostId = admin._id.toString();
        console.log(`📡 [CHAT_INIT] Admin Fallback active. Routing to: ${hostId}`);
      }
    }

    console.log(`📊 [CHAT_INIT] Extraction: RenterID=${renterId}, HostID=${hostId}`);

    if (!renterId || !hostId) {
      console.error(`❌ [CHAT_INIT] Integrity Failure: Missing participant data. Renter=${renterId}, Host=${hostId}`);
      return res.status(400).json({ message: "Fleet Integrity Failure: Missing participant metadata" });
    }

    if (userId !== renterId && userId !== hostId) {
      console.error(`❌ [CHAT_INIT] Authorization Breach: User ${userId} is not part of this booking`);
      return res.status(403).json({ message: "Sovereign Override: Access Denied" });
    }

    // 2. Check if chat already exists
    let chat = await Chat.findOne({ bookingId });

    if (!chat) {
      console.log(`🔱 [CHAT_INIT] Creating new tactical thread for Booking: ${bookingId}`);
      chat = await Chat.create({
        bookingId,
        renterId,
        hostId,
        participants: [renterId, hostId],
        status: "active"
      });
    } else {
      console.log(`🔄 [CHAT_INIT] Resuming existing thread: ${chat._id}`);
    }

    res.status(200).json(chat);
  } catch (error: any) {
    console.error(`💥 [CHAT_INIT] Critical Failure:`, error);
    res.status(500).json({ message: "Chat Initialization Failure", error: error.message });
  }
};

// 🔱 Get all chats for the authenticated user
export const getUserChats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const chats = await Chat.find({ participants: userId })
      .populate("renterId", "name image")
      .populate("hostId", "name image")
      .populate({
        path: "bookingId",
        populate: { path: "carId", select: "name image" }
      })
      .sort({ lastMessageAt: -1 });

    res.status(200).json(chats);
  } catch (error: any) {
    res.status(500).json({ message: "Sync Error: Failed to retrieve user chats", error: error.message });
  }
};

// 🔱 Get messages for a specific chat room
export const getMessages = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = (req as any).user.id;
    const { page = 1, limit = 50 } = req.query;

    const chat = await Chat.findById(chatId);
    const { role } = (req as any).user;
    const participantIds = chat?.participants.map(p => p.toString()) || [];

    if (!chat || (role !== "admin" && !participantIds.includes(userId))) {
      return res.status(403).json({ message: "Security Breach: Unauthorized Access to Thread" });
    }

    const messages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.status(200).json(messages.reverse());
  } catch (error: any) {
    res.status(500).json({ message: "Thread Retrieval Error", error: error.message });
  }
};

// 🔱 REST Fallback for Sending Message (Optional, useful for uploads)
export const sendMessageRest = async (req: Request, res: Response) => {
    try {
        const { chatId, text, image, receiverId, messageType = "text" } = req.body;
        const senderId = (req as any).user.id;

        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: "Thread not found" });

        const message = await Message.create({
            chatId,
            senderId,
            receiverId,
            text,
            image,
            messageType
        });

        // Update Chat summary
        chat.lastMessage = messageType === "text" ? text : `[Image]`;
        chat.lastMessageAt = new Date();
        
        // Handling unread counts via Map (ensure it exists)
        if (!chat.unreadCount) chat.unreadCount = new Map();
        const currentUnread = chat.unreadCount.get(receiverId) || 0;
        chat.unreadCount.set(receiverId, currentUnread + 1);
        
        await chat.save();

        res.status(201).json(message);
    } catch (error: any) {
        res.status(500).json({ message: "Message Transmission Failure", error: error.message });
    }
};

// 🔱 Mark messages as seen
export const markMessageSeen = async (req: Request, res: Response) => {
    try {
        const { chatId } = req.params;
        const userId = (req as any).user.id;

        await Message.updateMany(
            { chatId, receiverId: userId, isSeen: false },
            { $set: { isSeen: true, seenAt: new Date() } }
        );

        const chat = await Chat.findById(chatId);
        if (chat && chat.unreadCount) {
            chat.unreadCount.set(userId, 0);
            await chat.save();
        }

        res.status(200).json({ message: "Read Receipt Synchronized" });
    } catch (error: any) {
        res.status(500).json({ message: "Receipt Sync Error", error: error.message });
    }
};

// 🔱 Admin: Retrieve All Global Platform Threads
export const getAllChats = async (req: Request, res: Response) => {
  try {
    const { role } = (req as any).user;
    if (role !== "admin") return res.status(403).json({ message: "Sovereign Access Denied" });

    const chats = await Chat.find()
      .populate("renterId", "name email image")
      .populate("hostId", "name email image")
      .populate({
        path: "bookingId",
        populate: { path: "carId", select: "name image" }
      })
      .sort({ lastMessageAt: -1 });

    res.status(200).json(chats);
  } catch (error: any) {
    res.status(500).json({ message: "Global Sync Failure", error: error.message });
  }
};
