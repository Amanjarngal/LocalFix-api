import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { User } from "../models/userSchema.js";
import { Booking } from "../models/bookingSchema.js";
import { Complaint } from "../models/complaintSchema.js";
dotenv.config();

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { messages } = req.body; 

        if (!process.env.OPEN_ROUTER_API_KEY) {
            return res.status(500).json({ error: "OPEN_ROUTER_API_KEY is not configured on the server." });
        }

        let cleanApiKey = process.env.OPEN_ROUTER_API_KEY.trim().replace(/['"]/g, '');

        if (!cleanApiKey.startsWith('sk-or-')) {
            return res.status(500).json({ 
                error: "INVALID_KEY_FORMAT", 
                message: "Your OPEN_ROUTER_API_KEY must start with 'sk-or-v1-'. It looks like you copied it incorrectly. Please generate a new key on OpenRouter." 
            });
        }

        // ==========================================
        // 1. DYNAMIC USER & BOOKING CONTEXT INJECTION
        // ==========================================
        let currentUser = null;
        let bookingsInfoContext = "";
        let complaintsInfoContext = "";

        try {
            const token = req.cookies?.token;
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
                currentUser = await User.findById(decoded.id);

                if (currentUser && currentUser.role === 'customer') {
                    // Fetch recent bookings to inject into Gemini's memory
                    const userBookings = await Booking.find({ customer: currentUser._id })
                        .populate('provider', 'name')
                        .populate('service', 'name')
                        .sort({ createdAt: -1 })
                        .limit(5);

                    bookingsInfoContext = `
---
CURRENT AUTHENTICATED USER CONTEXT:
User Name: ${currentUser.name}
User Email: ${currentUser.email}

USER'S RECENT BOOKINGS (Status & Updates):
${userBookings.length > 0 
    ? userBookings.map(b => `- Booking ID: ${b._id} | Service: ${b.service?.name || 'LocalFix Service'} | Status: ${b.status} | Provider: ${b.provider?.name || 'Searching...'} | Date: ${b.scheduledDate}`).join('\n')
    : "No recent bookings."}
---
`;

                    // Fetch user's complaints for tracking
                    const userComplaints = await Complaint.find({ raisedBy: currentUser._id })
                        .sort({ createdAt: -1 })
                        .limit(5);

                    complaintsInfoContext = `
---
USER'S COMPLAINTS (for tracking):
${userComplaints.length > 0
    ? userComplaints.map(c => `- Complaint ID: ${c._id} | Title: ${c.title} | Status: ${c.status} | Category: ${c.aiCategory || 'N/A'} | Admin Response: ${c.adminResponse || 'Awaiting admin review'} | Filed on: ${new Date(c.createdAt).toLocaleDateString()}`).join('\n')
    : "No complaints filed yet."}
---
`;
                }
            }
        } catch (e) {
            console.error("Chatbot Auth Parsing Error (Continuing in Guest Mode) ", e.message);
        }

const SYSTEM_PROMPT = `
You are the LocalFix Assistant, a highly professional customer service chatbot.
Rules:
1. Be polite, concise, and helpful. Use clear lists.
2. **Bookings & Updates:** Show live status from the USER'S RECENT BOOKINGS below.
3. **Complaint Tracking:** If user asks to track complaints, show their complaint status from the USER'S COMPLAINTS section below. Include the Complaint ID, current status, and admin response if available.
4. **Complaint Categories:** service_quality, technical_system, payment_related, other
5. **Raising Complaints:** Ask for Booking ID + issue description, then call 'raise_complaint' tool.
6. Do NOT make up booking or complaint IDs.
7. If the user is not logged in, tell them to log in first.
${bookingsInfoContext}
${complaintsInfoContext}
`;

        // ==========================================
        // 2. OPEN_ROUTER PAYLOAD WITH GEMINI CAPABILITIES
        // ==========================================
        const openRouterPayload = {
            model: "google/gemini-2.0-flash-001",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...messages
            ],
            tools: [
                {
                    type: "function",
                    function: {
                        name: "raise_complaint",
                        description: "Raises a formal complaint in the LocalFix backend database. Only call this tool if the user explicitly wants to file a complaint and provides a valid Booking ID and issue description.",
                        parameters: {
                            type: "object",
                            properties: {
                                bookingId: { type: "string", description: "The specific Booking ID from the user's booking history." },
                                issue_description: { type: "string", description: "The detailed explanation of the user's issue or complaint." },
                                category: { type: "string", enum: ["service_quality", "technical_system", "payment_related", "other"], description: "The AI categorized type of complaint based on the user's issue." }
                            },
                            required: ["bookingId", "issue_description", "category"]
                        }
                    }
                }
            ]
        };

        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", openRouterPayload, {
            headers: {
                "Authorization": `Bearer ${cleanApiKey}`,
                "HTTP-Referer": "http://localhost:5173", 
                "X-Title": "LocalFix Platform",
                "Content-Type": "application/json"
            }
        });

        const replyMessage = response.data.choices[0].message;

        // ==========================================
        // 3. TOOL CALLING INTERCEPTOR (Automated Action Pipeline)
        // ==========================================
        if (replyMessage.tool_calls && replyMessage.tool_calls.length > 0) {
            const toolCall = replyMessage.tool_calls[0];

            if (toolCall.function.name === 'raise_complaint') {
                if (!currentUser) {
                    return res.status(200).json({ response: "You must be logged in to raise a complaint. Please log in first." });
                }

                try {
                    const args = JSON.parse(toolCall.function.arguments);
                    
                    // Validate that bookingId is a proper MongoDB ObjectId
                    const mongoose = (await import('mongoose')).default;
                    if (!mongoose.isValidObjectId(args.bookingId)) {
                        return res.status(200).json({ response: `The Booking ID \`${args.bookingId}\` doesn't look valid. Please provide the correct Booking ID from your bookings list.` });
                    }

                    // Fetch booking and populate the provider (which links to a User)
                    const targetBooking = await Booking.findById(args.bookingId).populate('provider', 'user');
                    
                    if (!targetBooking) {
                        return res.status(200).json({ response: `I couldn't locate a booking with ID \`${args.bookingId}\`. Please check your Booking ID and try again.` });
                    }

                    // The `against` field requires a User ObjectId.
                    // Provider model has a `user` field that references the User.
                    // Fallback to the current user's own ID if no provider is assigned yet.
                    let againstUserId = currentUser._id;
                    if (targetBooking.provider && targetBooking.provider.user) {
                        againstUserId = targetBooking.provider.user;
                    }

                    const generatedComplaint = await Complaint.create({
                        booking: targetBooking._id,
                        raisedBy: currentUser._id,
                        raisedByRole: 'customer',
                        against: againstUserId,
                        title: args.issue_description.substring(0, 140) || "Complaint raised via AI Assistant",
                        description: args.issue_description,
                        aiCategory: args.category || 'other',
                        geminiModelUsed: "google/gemini-2.0-flash-001",
                        status: 'pending'
                    });

                    // Real-time: notify admin and user
                    const io = req.app.get('io');
                    if (io) {
                        io.to('admin_room').emit('complaint_created', generatedComplaint);
                        io.to(currentUser._id.toString()).emit('complaint_created', generatedComplaint);
                    }

                    return res.status(200).json({ 
                        response: `✅ **Complaint Successfully Logged!**\n\nI have filed this issue for LocalFix Admins to review.\n\n- **Complaint ID:** \`${generatedComplaint._id}\`\n- **Against Booking:** \`${args.bookingId}\`\n- **Category:** ${args.category || 'other'}\n- **Status:** Pending\n\nYou can track this complaint anytime by asking me: *"Track my complaints"*` 
                    });

                } catch (toolError) {
                    console.error("=== COMPLAINT TOOL ERROR ===");
                    console.error("Error Name:", toolError.name);
                    console.error("Error Message:", toolError.message);
                    if (toolError.errors) {
                        Object.keys(toolError.errors).forEach(field => {
                            console.error(`  Field '${field}':`, toolError.errors[field].message);
                        });
                    }
                    return res.status(200).json({ response: `I had trouble saving your complaint: ${toolError.message}. Please try again or navigate to 'Profile > Orders' to raise it manually.` });
                }
            }
        }

        // If no tools were called, return standard conversational response
        res.status(200).json({ response: replyMessage.content });

    } catch (error) {
        console.error("OpenRouter API Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to communicate with AI provider" });
    }
});

export default router;
