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
import cartRoutes from "./routes/cartRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js";
import adminSettingsRoutes from "./routes/adminSettingsRoutes.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import renovationRoutes from "./routes/renovationRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.FRONTEND_URL,
].filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

// Make io accessible to all routes via req.app
app.set("io", io);

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

// ─── Socket.IO Connection Handler ───
io.on("connection", (socket) => {
  console.log(`⚡ Socket connected: ${socket.id}`);

  // Allow clients to join their own user room for targeted events
  socket.on("join", (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`👤 User ${userId} joined room`);
    }
  });

  // Admin joins admin room
  socket.on("join_admin", () => {
    socket.join("admin_room");
    console.log(`🛡️  Admin joined admin_room`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

const startServer = async () => {
  try {
    await connectdb();
    console.log("MongoDB connected");

    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server start failed:", err.message);
    process.exit(1);
  }
};

startServer();

export default app;