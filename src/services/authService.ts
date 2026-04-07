import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/users";

// Helper: Generate Access Token
const generateAccessToken = (user: IUser) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.ACCESS_TOKEN_SECRET || "access_secret",
    { expiresIn: "1h" }
  );
};

// Helper: Generate Refresh Token
const generateRefreshToken = (user: IUser) => {
  return jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET || "refresh_secret",
    { expiresIn: "7d" }
  );
};

// 🔐 Register Service
export const registerService = async ({ name, email, password, role }: any) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    name,
    email,
    password: hashedPassword,
    role: role || "user",
  });

  await user.save();

  return { message: "User registered successfully" };
};


// 🔑 Login Service
export const loginService = async ({ email, password }: any) => {
  const user = await User.findOne({ email });

  if (!user) throw new Error("User not found");
  if (!user.password) throw new Error("This account uses social login");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid password");

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save();

  return {
    message: "Login successful",
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

// 🔄 Refresh Token Service
export const refreshTokenService = async ({ token }: any) => {
  if (!token) throw new Error("Refresh token required");

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || "refresh_secret");
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }

  const user = await User.findById(decoded.id);

  if (!user || user.refreshToken !== token) {
    throw new Error("Invalid refresh token associated with user");
  }

  const newAccessToken = generateAccessToken(user);

  return { accessToken: newAccessToken };
};

// 🚪 Logout Service
export const logoutService = async ({ id }: any) => {
  if (!id) throw new Error("User ID is required for logout");

  const user = await User.findById(id);
  if (!user) throw new Error("User not found");

  user.refreshToken = null;
  await user.save();

  return { message: "Logout successful" };
};

// 🔱 Google Auth Callback Service
export const googleAuthCallbackService = async (user: any) => {
  const dbUser = await User.findById((user as any)._id);
  if (!dbUser) throw new Error("User not found");

  const accessToken = generateAccessToken(dbUser);
  const refreshToken = generateRefreshToken(dbUser);

  dbUser.refreshToken = refreshToken;
  await dbUser.save();

  return {
    accessToken,
    refreshToken,
    user: {
      id: dbUser._id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    },
  };
};

