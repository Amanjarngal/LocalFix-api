import jwt from "jsonwebtoken";
import { User } from "../models/userSchema.js";
// Protect routes - require login
export const protect = async (req, res, next) => {
  let token;

  console.log("Cookies:", req.cookies);
  console.log("Auth Header:", req.headers.authorization);

  // 1. Bearer token from header (Postman, mobile apps)
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }
    else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  console.log("Extracted Token:", token ? "Token present" : "No token");

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized - no token provided",
    });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = await User.findById(decoded.id).select("-password");
  if (!req.user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({
      success: false,
      message: "Not authorized - invalid or expired token",
    });
  }
};

// Restrict to specific roles (e.g. admin only)
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }
    next();
  };
};