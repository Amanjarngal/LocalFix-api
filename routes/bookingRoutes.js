import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import { upload } from '../utils/multerConfig.js';
import { createBooking, getMyBookings, getAllBookings, cancelBooking, getAvailableBookings, acceptBooking, getProviderBookings, updateBookingStatus, completeBooking, rateCustomer, rateProvider } from '../controllers/bookingController.js';

const router = express.Router();
router.use(protect); 

router.post('/', createBooking);
router.get('/my-bookings', getMyBookings);
router.get('/admin/all', restrictTo('admin'), getAllBookings);
router.patch('/cancel/:id', cancelBooking);
router.get('/provider/bookings', restrictTo('serviceProvider', 'admin'), getProviderBookings);
router.get('/provider/available', restrictTo('serviceProvider', 'admin'), getAvailableBookings);
router.patch('/provider/:id/accept', restrictTo('serviceProvider', 'admin'), acceptBooking);
router.patch('/provider/:id/status', restrictTo('serviceProvider', 'admin'), updateBookingStatus);
router.patch('/provider/:id/complete', restrictTo('serviceProvider', 'admin'), upload.fields([{ name: 'beforeImage', maxCount: 1 }, { name: 'afterImage', maxCount: 1 }]), completeBooking);
router.patch('/provider/:id/rate', restrictTo('serviceProvider', 'admin'), rateCustomer);
router.patch('/customer/:id/rate', rateProvider);

// ... more routes (cancel, confirm, etc.)

export default router;