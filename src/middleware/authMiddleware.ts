import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Verify token to establish identity
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: "No token provided" });
        }

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "access_secret");
        (req as any).user = decoded; // { id, role, ... }
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired access token" });
    }
};

// Check specific roles
export const authorizeRole = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Requires authenticate to have successfully run prior to this
        const user = (req as any).user;
        if (!user || !allowedRoles.includes(user.role)) {
            return res.status(403).json({
                message: "Forbidden: You do not have the required access level for this action."
            });
        }
        next();
    };
};
