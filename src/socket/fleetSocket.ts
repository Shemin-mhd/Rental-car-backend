import { Server, Socket } from "socket.io";

/**
 * 🛰️ Fleet Tracking Protocol
 * Handles real-time telemetry from active deployments
 */
export const initFleetSocket = (io: Server) => {
    io.on("connection", (socket: Socket) => {
        
        // 🛡️ Join specific mission channel
        socket.on("joinMission", (bookingId: string) => {
            socket.join(`mission-${bookingId}`);
            console.log(`📡 [FLEET] Node joined mission channel: ${bookingId}`);
        });

        // 📍 Broadcast Live Telemetry
        // This event is triggered by the driver's device / simulated unit
        socket.on("reportLocation", (data: { bookingId: string; lat: number; lng: number; speed?: number }) => {
            const { bookingId, lat, lng, speed } = data;
            
            // 🔱 Broadcast to all admins and trackers watching this mission
            io.to(`mission-${bookingId}`).emit("locationUpdate", {
                lat,
                lng,
                speed: speed || 0,
                timestamp: new Date()
            });

            console.log(`🛰️ [TELEMETRY] Mission ${bookingId.slice(-4)}: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
        });

        socket.on("disconnect", () => {
            // Cleanup logic if needed
        });
    });
};
