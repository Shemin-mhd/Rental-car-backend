// server.ts

import dotenv from "dotenv";
dotenv.config(); // ✅ Search for .env in root

import express from "express";
import cors from "cors";
import passport from "passport";

import connectDB from "./src/config/db";
import routes from "./src/routes/index"; // central routes
import { Server } from "socket.io";
import { createServer } from "http";
import { initCronJobs } from "./src/utils/cronJobs";
import { initChatSocket } from "./src/socket/chatSocket";
import { initFleetSocket } from "./src/socket/fleetSocket";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3005",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true
  }
});


// ✅ Export io for use in controllers
(global as any).io = io;

// 🔱 Initialize Specialized Socket Protocols
initChatSocket(io);
initFleetSocket(io);

// ✅ middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3005",
  credentials: true
}));
app.use(express.json());
app.use(passport.initialize());
app.use("/uploads", express.static("uploads")); // Allow public access to uploaded docs


// ✅ connect database
(async () => {
  try {
    await connectDB();
    // 🔱 Initialize Elite Fleet Monitoring
    initCronJobs();
  } catch (error) {
    console.error("Critical Connection Failure:", error);
  }
})();

// ✅ routes
app.use("/api", routes);

// ✅ error handler (Ensure errors are always JSON)
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Global Error Handler Catch:", err.message);
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

// ✅ test route
app.get("/", (req, res) => {
  res.send("API Running...");
});

// ✅ server start
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


