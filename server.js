import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectdb } from "./config/db.js";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import userRoutes from "./routes/userRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import providerRoutes from "./routes/providerRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";
import problemRoutes from "./routes/problemRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminSettingsRoutes from "./routes/adminSettingsRoutes.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import renovationRoutes from "./routes/renovationRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ─── Allowed Origins ───
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.FRONTEND_URL,
].filter(Boolean);

// ─── CORS ───
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed: " + origin));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Lazy DB Connection Middleware ───
// On Vercel serverless, we connect before handling the first request.
// Mongoose keeps the connection alive across warm invocations.
let dbConnected = false;
app.use(async (req, res, next) => {
  if (!dbConnected) {
    try {
      await connectdb();
      dbConnected = true;
    } catch (err) {
      console.error("DB connection failed:", err.message);
      return res.status(500).json({ message: "Database connection failed" });
    }
  }
  next();
});

// ─── Routes ───
app.use("/api/auth", userRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/renovations", renovationRoutes);
app.use("/api/chat", chatbotRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "Server is running", status: "ok" });
});

app.get("/", (req, res) => {
  res.status(200).json({ message: "LocalFix API is live ✅" });
});

// ─── Local Dev: start HTTP server + Socket.IO ───
// On Vercel this block is skipped (no PORT in serverless context).
if (process.env.NODE_ENV !== "production" || process.env.PORT) {
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
    }
  });

  app.set("io", io);

  io.on("connection", (socket) => {
    console.log(`⚡ Socket connected: ${socket.id}`);

    socket.on("join", (userId) => {
      if (userId) {
        socket.join(userId);
        console.log(`👤 User ${userId} joined room`);
      }
    });

    socket.on("join_admin", () => {
      socket.join("admin_room");
      console.log(`🛡️  Admin joined admin_room`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  const PORT = process.env.PORT || 7000;
  connectdb()
    .then(() => {
      httpServer.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Server start failed:", err.message);
      process.exit(1);
    });
}

// ─── Export for Vercel Serverless ───
export default app;