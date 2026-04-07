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

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3005"], // Adjust depending on frontend URL
    methods: ["GET", "POST"]
  }
});

// ✅ Export io for use in controllers
(global as any).io = io;

io.on("connection", (socket) => {
  console.log("Client connected to WebSocket 🛰️");
  
  socket.on("join", (room) => {
    socket.join(room);
    console.log(`User joined room: ${room} 🛡️`);
    if (room === "admin-channel") {
      console.log("Admin Dashboard Connected to Alert System 🔱");
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected 🔌");
  });
});

// ✅ middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use("/uploads", express.static("uploads")); // Allow public access to uploaded docs


// ✅ connect database
connectDB();

// 🔱 Initialize Elite Fleet Monitoring
initCronJobs();

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