import { Booking } from '../models/bookingSchema.js';
import { Provider } from '../models/providerSchema.js';
import { Service, Problem } from '../models/serviceSchema.js';
import { Payout } from '../models/payoutSchema.js';
export const createBooking = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      providerId,
      problemIds, // Now expecting an array of Problem IDs
      scheduledDate,
      startTime,
      address,
      city,
      area,
      pincode,
      contactName,
      contactNumber,
      customerNotes,
      paymentMethod = 'cash',
      razorpayOrderId,
      razorpayPaymentId,
    } = req.body;

    if (!problemIds || !Array.isArray(problemIds) || problemIds.length === 0 || !scheduledDate || !startTime || !address) {
      return res.status(400).json({ success: false, message: 'Missing required fields (problemIds array, date, time, address)' });
    }

    // 1. Fetch all Problems
    const problems = await Problem.find({ _id: { $in: problemIds } }).populate('service');
    if (problems.length !== problemIds.length) {
      return res.status(404).json({ success: false, message: 'One or more problem/service items not found' });
    }

    // Ensure all problems belong to the same service category (optional but recommended)
    const serviceIds = [...new Set(problems.map(p => p.service._id.toString()))];
    if (serviceIds.length > 1) {
      return res.status(400).json({ success: false, message: 'All items must belong to the same service category' });
    }

    const actualServiceId = problems[0].service._id;
    const serviceTotal = problems.reduce((sum, p) => sum + p.price, 0);

    // Fetch Platform Fee from Settings
    const { Settings } = await import("../models/settingsSchema.js");
    let settings = await Settings.findOne();
    if (!settings) settings = { platformFee: 50, feeType: 'fixed' };

    let platformFee = 0;
    if (settings.feeType === 'fixed') {
        platformFee = settings.platformFee;
    } else {
        platformFee = Math.round(serviceTotal * (settings.platformFee / 100));
    }

    const totalPrice = serviceTotal + platformFee;
    const providerEarning = serviceTotal; // Provider gets the full problem price, platform fee is additional

    // 2. Handle Provider Assignment for Approach 2
    // Don't auto-assign a provider. Create it as 'pending' to be accepted by any provider in the pincode.
    let finalProviderId = null;

    if (providerId) {
      // If explicitly provided (e.g., from direct booking)
      const provider = await Provider.findById(providerId);
      if (!provider || provider.status !== 'approved') {
        return res.status(400).json({ success: false, message: 'Selected provider is not available or approved' });
      }
      finalProviderId = providerId;
    }

    const booking = await Booking.create({
      customer: customerId,
      provider: finalProviderId,
      service: actualServiceId,
      problemItems: problemIds,
      scheduledDate: new Date(scheduledDate),
      startTime,
      address,
      city,
      area,
      pincode,
      contactName: contactName || req.user.name,
      contactNumber: contactNumber || '',
      customerNotes,
      paymentMethod,
      totalPrice,
      platformFee,
      providerEarning,
      razorpayOrderId,
      razorpayPaymentId,
      paymentStatus: paymentMethod === 'online' ? 'paid' : 'pending',
    });

    // Real-time: notify admin and relevant providers
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('booking_created', booking);
      io.emit('booking_update', { type: 'created', booking });
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully (pending confirmation)',
      data: booking,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user.id })
      .populate('provider', 'businessName ownerName phone')
      .populate('service', 'name basePrice')
      .populate('problemItems', 'title price description')
      .sort({ scheduledDate: -1 });

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('customer', 'name email phone')
      .populate('provider', 'businessName ownerName phone')
      .populate('service', 'name basePrice')
      .populate('problemItems', 'title price description')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Guard: Only customer can cancel their own booking
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    // Guard: Can only cancel if still pending (before provider accepts)
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a booking that is already ${booking.status}`
      });
    }

    booking.status = 'cancelled';
    booking.cancelledBy = 'customer';
    await booking.save();

    const io = req.app.get('io');
    if (io) {
      io.to(booking.customer.toString()).emit('booking_status_changed', { bookingId: booking._id, status: 'cancelled' });
      io.to('admin_room').emit('booking_update', { type: 'cancelled', booking });
    }

    res.json({ success: true, message: 'Booking cancelled successfully', data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAvailableBookings = async (req, res) => {
  try {
    const provider = await Provider.findOne({ user: req.user.id });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    // If provider has marked themselves as unavailable, return empty
    if (provider.isAvailable === false) {
      return res.json({ success: true, count: 0, data: [], message: 'You are currently set as unavailable.' });
    }

    // Build list of pincodes this provider covers
    // 1. Their registered main pincode (from enrollment)
    // 2. All pincodes from their serviceAreas array
    const coveredPincodes = new Set();

    if (provider.pincode) {
      coveredPincodes.add(String(provider.pincode));
    }

    if (provider.serviceAreas && provider.serviceAreas.length > 0) {
      provider.serviceAreas.forEach(area => {
        if (area.pincode) coveredPincodes.add(String(area.pincode));
      });
    }

    const pincodeArray = [...coveredPincodes];

    // Build the query filter
    const query = {
      status: 'pending',
      service: provider.primaryService,
      provider: null, // not yet assigned to any provider
    };

    // Filter by pincode if the provider has set service areas
    if (pincodeArray.length > 0) {
      query.pincode = { $in: pincodeArray };
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'name phone')
      .populate('service', 'name')
      .populate('problemItems', 'title price description')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const acceptBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const provider = await Provider.findOne({ user: req.user.id });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    // Find the booking and make sure it's still pending so double-accepts don't happen
    const booking = await Booking.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { provider: provider._id, status: 'accepted' },
      { new: true }
    );

    if (!booking) {
      return res.status(400).json({ success: false, message: 'Booking is no longer available or does not exist' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(booking.customer.toString()).emit('booking_status_changed', { bookingId: booking._id, status: 'accepted', providerId: provider._id });
      io.to('admin_room').emit('booking_update', { type: 'accepted', booking });
    }

    res.json({ success: true, message: 'Booking accepted successfully', data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProviderBookings = async (req, res) => {
  try {
    const provider = await Provider.findOne({ user: req.user.id });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    const bookings = await Booking.find({ provider: provider._id })
      .populate('customer', 'name phone')
      .populate('service', 'name')
      .populate('problemItems', 'title price description')
      .sort({ scheduledDate: -1 });

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['accepted', 'en_route', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status provided' });
    }

    const provider = await Provider.findOne({ user: req.user.id });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: id, provider: provider._id },
      { status },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(booking.customer.toString()).emit('booking_status_changed', { bookingId: booking._id, status });
      io.to('admin_room').emit('booking_update', { type: 'status_changed', booking });
    }

    res.json({ success: true, message: `Status updated to ${status.replace('_', ' ')}`, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const completeBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerRating, providerReview } = req.body;

    const provider = await Provider.findOne({ user: req.user.id });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    const booking = await Booking.findOne({ _id: id, provider: provider._id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    let beforeImage = booking.beforeImage;
    let afterImage = booking.afterImage;

    // Handle uploaded files
    if (req.files) {
      if (req.files.beforeImage && req.files.beforeImage.length > 0) {
        beforeImage = req.files.beforeImage[0].path; 
      }
      if (req.files.afterImage && req.files.afterImage.length > 0) {
        afterImage = req.files.afterImage[0].path;
      }
    }

    booking.status = 'completed';
    booking.beforeImage = beforeImage;
    booking.afterImage = afterImage;

    await booking.save();

    // Auto-create a pending payout record for admin to action
    const existingPayout = await Payout.findOne({ booking: booking._id });
    if (!existingPayout && booking.providerEarning > 0) {
      await Payout.create({
        booking: booking._id,
        provider: provider._id,
        amount: booking.providerEarning,
        platformFee: booking.platformFee,
        status: 'pending',
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(booking.customer.toString()).emit('booking_status_changed', { bookingId: booking._id, status: 'completed' });
      io.to('admin_room').emit('booking_update', { type: 'completed', booking });
    }

    res.json({ success: true, message: 'Booking completed successfully. Payout is queued for admin approval.', data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const rateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerRating, providerReview } = req.body;

    const provider = await Provider.findOne({ user: req.user.id });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    const booking = await Booking.findOne({ _id: id, provider: provider._id, status: 'completed' });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Completed booking not found' });
    }

    booking.providerRating = Number(providerRating);
    if (providerReview) booking.providerReview = providerReview;

    await booking.save();

    res.json({ success: true, message: 'Customer rated successfully', data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Customer Rates Provider
export const rateProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerRating, customerReview } = req.body;

    if (!customerRating) {
      return res.status(400).json({ success: false, message: 'Customer rating is required' });
    }

    const booking = await Booking.findOne({
      _id: id,
      customer: req.user._id,
      status: 'completed'
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Completed booking not found' });
    }

    booking.customerRating = Number(customerRating);
    if (customerReview) booking.customerReview = customerReview;

    await booking.save();

    // Recalculate Provider's Average Rating
    const providerId = booking.provider;
    if (providerId) {
      await Provider.recalculateRating(providerId);
    }

    res.json({ success: true, message: 'Provider rated successfully', data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};