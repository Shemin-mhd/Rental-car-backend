import { Request, Response } from "express";
import { registerService, loginService, refreshTokenService, logoutService, googleAuthCallbackService } from "../services/authService";

// Register Controller
export const register = async (req: Request, res: Response) => {
  try {
    const result = await registerService(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};


// Login Controller
export const login = async (req: Request, res: Response) => {
  try {
    const result = await loginService(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// 🔱 Google Auth Callback Controller
export const googleAuthCallback = async (req: Request, res: Response) => {
  try {
    // req.user is set by passport and we're just creating tokens for them
    const result = await googleAuthCallbackService(req.user);

    // ✅ Redirect back to frontend callback page with tokens in URL
    const FRONTEND_URL = process.env.FRONTEND_URL || "https://rental-car-lake.vercel.app/login";
    const redirect = (req as any).redirect || "";
    const frontendUrl = `${FRONTEND_URL}/google-callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}&user=${JSON.stringify(result.user)}&redirect=${encodeURIComponent(redirect)}`;
    res.redirect(frontendUrl); 
  } catch (error) {
    console.error("Google Auth Error:", error);
    const FRONTEND_URL = process.env.FRONTEND_URL || "https://rental-car-lake.vercel.app/login";
    res.redirect(`${FRONTEND_URL}/login?error=Google authentication failed`);
  }
};

// Refresh Token Controller
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const result = await refreshTokenService(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ message: error.message }); 
  }
};

// Logout Controller
export const logout = async (req: Request, res: Response) => {
  try {
    const { id } = (req as any).user;
    const result = await logoutService({ id });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
