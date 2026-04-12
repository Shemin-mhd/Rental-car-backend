import { Server, Socket } from "socket.io";
import Chat from "../models/chats";
import Message from "../models/messages";

const onlineUsers = new Map<string, string>(); // userId -> socketId

export const initChatSocket = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    
    // 🔱 User Signal: Register online status
    socket.on("register-user", (userId: string) => {
      onlineUsers.set(userId, socket.id);
      console.log(`📡 Signal Active: Node ${userId} localized at ${socket.id}`);
      io.emit("user-status-change", { userId, status: "online" });
    });

    // 🔱 Thread Synchronize: Join specific booking room
    socket.on("join-chat", (chatId: string) => {
      socket.join(chatId);
      console.log(`🗄️ Thread Uplink: Socket ${socket.id} merged with chat ${chatId}`);
    });

    // 🔱 Data Transmission: Real-time Messaging
    socket.on("send-message", async (data: {
      chatId: string,
      senderId: string,
      receiverId: string,
      text?: string,
      image?: string,
      messageType: "text" | "image" | "system"
    }) => {
      try {
        const { chatId, senderId, receiverId, text, image, messageType } = data;

        // 1. Persist to Intelligence Core (DB)
        const message = await Message.create({
          chatId,
          senderId,
          receiverId,
          text,
          image,
          messageType
        });

        // 2. Update Chat Protocol Hash
        const chat = await Chat.findById(chatId);
        if (chat) {
          chat.lastMessage = messageType === "text" ? text : "[Image Transmission]";
          chat.lastMessageAt = new Date();
          
          if (!chat.unreadCount) chat.unreadCount = new Map();
          const current = chat.unreadCount.get(receiverId) || 0;
          chat.unreadCount.set(receiverId, current + 1);
          
          await chat.save();
        }

        // 3. Broadcast across Synchronized Interface
        io.to(chatId).emit("receive-message", message);
        
        // 4. Update the Receiver's Chat List Signal
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("chat-list-update", { chatId, lastMessage: chat?.lastMessage });
        }

      } catch (error) {
        console.error("Transmission Interrupted:", error);
      }
    });

    // 🔱 Biometric Activity: Typing Indicators
    socket.on("typing", ({ chatId, userId }: { chatId: string, userId: string }) => {
      socket.to(chatId).emit("user-typing", { userId });
    });

    socket.on("stop-typing", ({ chatId, userId }: { chatId: string, userId: string }) => {
      socket.to(chatId).emit("user-stop-typing", { userId });
    });

    // 🏎️ Tactical Telemetry: Live Location Tracking
    socket.on("update-car-location", (data: {
      carId: string,
      carName: string,
      lat: number,
      lng: number,
      bookingId?: string
    }) => {
      const { carId, carName, lat, lng } = data;
      console.log(`📍 [TELEMETRY] Car ${carName} localized at ${lat}, ${lng}`);
      
      // Broadcast to the car-specific room with Identity Markers
      io.to(`track-${carId}`).emit("car-location-updated", { 
        carId, 
        carName, 
        lat, 
        lng, 
        timestamp: new Date() 
      });
      
      // Also broadcast to the Global Admin Channel
      io.to("admin-channel").emit("global-car-movement", { 
        carId, 
        carName, 
        lat, 
        lng 
      });
    });

    socket.on("join-tracking", (carId: string) => {
      socket.join(`track-${carId}`);
      console.log(`📡 [TRACKING] Socket ${socket.id} subscribed to Car ${carId} telemetry`);
    });

    // 🔱 Protocol Eject: Cleanup
    socket.on("disconnect", () => {
      let disconnectedUserId: string | undefined;
      for (let [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          onlineUsers.delete(userId);
          break;
        }
      }
      if (disconnectedUserId) {
          console.log(`🔌 Signal Lost: Node ${disconnectedUserId} offline`);
          io.emit("user-status-change", { userId: disconnectedUserId, status: "offline" });
      }
    });
  });
};
