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

    // 🔱 Join personal notification room (user-{userId})
    socket.on("join-user-room", (userId: string) => {
      socket.join(`user-${userId}`);
      console.log(`🔔 Notification Room: user-${userId} joined`);
    });

    // 🔱 Thread Synchronize: Join specific booking room
    socket.on("join-chat", (chatId: string) => {
      socket.join(chatId);
      console.log(`🗄️ Thread Uplink: Socket ${socket.id} merged with chat ${chatId}`);
    });

    // 🔱 Admin Protocol: Join global admin channel
    socket.on("join-admin-room", () => {
      socket.join("admins-room");
      console.log(`💂 Tactical Command: Socket ${socket.id} elevated to Admin Room`);
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

        // 5. Admin Global Intelligence: Sync all admins for platform-owned assets
        if (chat?.carId) {
           // We could check if it is an admin fleet car, but easier to just notify all admins if the receiver is an admin
           // or we can just notify all admins of all messages? No, just admin-related ones.
           io.to("admins-room").emit("chat-list-update", { chatId, lastMessage: chat?.lastMessage });
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
