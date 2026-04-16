import { Complaint } from '../models/complaintSchema.js';
import { Booking } from '../models/bookingSchema.js';
import { User } from '../models/userSchema.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import mongoose from 'mongoose';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const GEMINI_MODEL_NAME = 'gemini-2.5-flash';

// In-memory chat sessions (key: userId_bookingId)
// In production: use Redis, Mongo, or session store
const activeChatSessions = new Map(); // value = { chatSession, messages: [], bookingId }


// ────────────────────────────────────────────────
// Existing functions (unchanged)
// ────────────────────────────────────────────────

export const raiseComplaint = async (req, res) => {
  try {
    const { bookingId, title, description } = req.body;
    const userId = req.user.id;

    if (!bookingId || !title || !description) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    let raisedByRole, againstId;
    if (req.user.role === 'customer') {
      raisedByRole = 'customer';
      againstId = booking.provider;
    } else if (req.user.role === 'serviceProvider') {
      raisedByRole = 'provider';
      againstId = booking.customer;
    } else {
      return res.status(403).json({ success: false, message: "Only customers or providers can raise complaints" });
    }

    if (raisedByRole === 'customer' && booking.customer.toString() !== userId) {
      return res.status(403).json({ success: false, message: "You can only complain about your own bookings" });
    }
    if (raisedByRole === 'provider' && booking.provider.toString() !== userId) {
      return res.status(403).json({ success: false, message: "You can only complain about your own bookings" });
    }

    const complaint = await Complaint.create({
      booking: bookingId,
      raisedBy: userId,
      raisedByRole,
      against: againstId,
      title,
      description,
      attachments: req.files?.map(file => ({
        name: file.originalname,
        path: file.path,
      })) || [],
    });

    res.status(201).json({
      success: true,
      message: "Complaint raised successfully",
      data: complaint,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getComplaints = async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { raisedBy: req.user.id };

    const complaints = await Complaint.find(query)
      .populate('booking', 'scheduledDate status')
      .populate('raisedBy', 'name email role')
      .populate('against', 'name email role')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: complaints.length, data: complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateComplaint = async (req, res) => {
  try {
    const { status, adminResponse } = req.body;
    const complaintId = req.params.id;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Only admin can update complaints" });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    if (status) complaint.status = status;
    if (adminResponse) complaint.adminResponse = adminResponse;
    if (status === 'resolved' || status === 'closed') {
      complaint.resolvedBy = req.user.id;
      complaint.resolvedAt = new Date();
    }

    await complaint.save();

    res.json({
      success: true,
      message: "Complaint updated successfully",
      data: complaint,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────
// NEW: AI Chatbot for better complaint description
// ────────────────────────────────────────────────

export const startAIChatForComplaint = async (req, res) => {
  try {
    const { bookingId, initialMessage = '' } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Authorization (same logic as raiseComplaint)
    let allowedRole;
    if (req.user.role === 'customer' && booking.customer.toString() === userId) {
      allowedRole = 'customer';
    } else if (req.user.role === 'serviceProvider' && booking.provider.toString() === userId) {
      allowedRole = 'provider';
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });

    const sessionKey = `${userId}_${bookingId}`;

    const systemInstruction = `
You are a helpful assistant helping the user write a clear, polite complaint description.
Focus on these categories: payment related, service quality (provider issues), technical/system issues.
Ask clarifying questions if needed.
Structure final description: What happened → Details (date/time) → Impact → What you want.
When you have enough info and the user seems ready, include [READY] at the end followed by the final description only.
Keep replies concise.
`;

    const chatSession = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemInstruction }],  // ← moved here
        },
        {
          role: "model",
          parts: [{ text: "Understood! I'll help you write a clear and professional complaint." }],
        },
        {
          role: "user",
          parts: [{ text: `Booking info: Service=${booking.service?.name || 'Unknown'}, Date=${booking.scheduledDate?.toDateString() || 'Unknown'}, Total=₹${booking.totalPrice || 'N/A'}, Status=${booking.status}. User role: ${allowedRole}.` }],
        },
        {
          role: "model",
          parts: [{ text: "Got it! Please describe what happened with your booking so I can help you write a good complaint." }],
        },
      ],
      generationConfig: { temperature: 0.6, maxOutputTokens: 600 },
      // ← systemInstruction REMOVED from here
    });

    let firstReply = "Please tell me what issue you're facing with this booking.";
    if (initialMessage.trim()) {
      const result = await chatSession.sendMessage(initialMessage);
      firstReply = result.response.text();
    }

    activeChatSessions.set(sessionKey, {
      chatSession,
      messages: [{ role: 'assistant', content: firstReply }],
      bookingId,
      userRole: allowedRole,
    });

    return res.status(200).json({
      success: true,
      sessionKey,
      reply: firstReply,
    });
  } catch (err) {
    console.error('Start AI chat error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const sendMessageToAIChat = async (req, res) => {
  try {
    const { sessionKey, message } = req.body;

    if (!sessionKey || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'sessionKey and message are required' });
    }

    const session = activeChatSessions.get(sessionKey);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Chat session not found or expired' });
    }

    const result = await session.chatSession.sendMessage(message);
    const reply = result.response.text();

    session.messages.push({ role: 'user', content: message });
    session.messages.push({ role: 'assistant', content: reply });

    let finalDescription = null;
    if (reply.includes('[READY]')) {
      finalDescription = reply.split('[READY]')[1]?.trim() || reply;
    }

    return res.status(200).json({
      success: true,
      reply,
      finalDescription,
      isReady: !!finalDescription,
    });
  } catch (err) {
    console.error('Send AI message error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const finalizeComplaintWithAI = async (req, res) => {
  try {
    const { sessionKey, title } = req.body;

    const session = activeChatSessions.get(sessionKey);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Chat session not found' });
    }

    // Get last reply (should have [READY])
    const lastReply = session.messages[session.messages.length - 1]?.content || '';
    let description = lastReply;
    if (lastReply.includes('[READY]')) {
      description = lastReply.split('[READY]')[1]?.trim() || lastReply;
    }

    if (!description || description.length < 30) {
      return res.status(400).json({ success: false, message: 'No valid description ready from AI chat' });
    }

    const userId = req.user.id;

    const complaint = await Complaint.create({
      booking: session.bookingId,
      raisedBy: userId,
      raisedByRole: session.userRole,
      against: session.userRole === 'customer' ? (await Booking.findById(session.bookingId)).provider : (await Booking.findById(session.bookingId)).customer,
      title: title || 'Complaint assisted by AI',
      description,
      attachments: [], // can extend later if you allow uploads during chat
    });

    // Clean up
    activeChatSessions.delete(sessionKey);

    return res.status(201).json({
      success: true,
      message: "Complaint created with AI assistance",
      data: complaint,
    });
  } catch (err) {
    console.error('Finalize AI complaint error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};