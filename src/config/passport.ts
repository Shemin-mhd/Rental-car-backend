import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/users';
import dotenv from 'dotenv';
import path from 'path';

// dotenv logic matches server.ts
dotenv.config();


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://https://rental-car-backend-7np6.onrender.com/api/auth/google/callback",
    passReqToCallback: true // ✅ Pass req to callback to access state
  },
  async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // ✅ state comes back as role:redirectUrl
      const state = (req.query.state as string) || 'user:';
      const [role, redirect] = state.split(':');
      req.redirect = redirect || ""; // Attach redirect to req to use in controller

      // ✅ Find user by email
      let user = await User.findOne({ email: profile.emails[0].value });
      
      if (!user) {
        // ✅ If user doesn't exist, create it with chosen role
        user = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          role: role // Use role from state
        });
        await user.save();
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));


// We don't use sessions since we're using JWTs
passport.serializeUser((user: any, done: any) => done(null, user));
passport.deserializeUser((obj: any, done: any) => done(null, obj));

export default passport;
