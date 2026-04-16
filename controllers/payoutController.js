import axios from 'axios';
import { Provider } from '../models/providerSchema.js';
import { Booking } from '../models/bookingSchema.js';
import { Payout } from '../models/payoutSchema.js';
import dotenv from 'dotenv';
dotenv.config();

const razorpayAuth = () =>
    Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');

const razorpayHeaders = () => ({
    Authorization: `Basic ${razorpayAuth()}`,
    'Content-Type': 'application/json',
});

// ────────────────────────────────────────────────────
// 1. Provider saves/updates their bank details
// ────────────────────────────────────────────────────
export const saveBankDetails = async (req, res) => {
    try {
        const { accountNumber, ifscCode, accountHolderName, bankName, upiId, payoutMethod } = req.body;
        const provider = await Provider.findOne({ user: req.user.id });
        if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });

        provider.bankDetails = { accountNumber: accountNumber || '', ifscCode: ifscCode || '', accountHolderName: accountHolderName || '', bankName: bankName || '', upiId: upiId || '' };
        provider.payoutMethod = payoutMethod || 'bank_transfer';
        await provider.save();

        res.json({ success: true, message: 'Bank details saved successfully', data: { bankDetails: provider.bankDetails, payoutMethod: provider.payoutMethod } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ────────────────────────────────────────────────────
// 2. Create Razorpay Linked Account (with graceful fallback)
// ────────────────────────────────────────────────────
export const createLinkedAccount = async (req, res) => {
    try {
        const provider = await Provider.findOne({ user: req.user.id });
        if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });

        if (provider.razorpayAccountId && !provider.razorpayAccountId.startsWith('local_')) {
            return res.json({ success: true, message: 'Razorpay linked account already exists', data: { razorpayAccountId: provider.razorpayAccountId } });
        }

        const bd = provider.bankDetails;
        if (!bd || (!bd.accountNumber && !bd.upiId)) {
            return res.status(400).json({ success: false, message: 'Please save complete bank details first.' });
        }

        try {
            const payload = {
                email: provider.email, phone: provider.phone, legal_business_name: provider.businessName,
                business_type: 'individual', legal_info: { pan: provider.idProof?.idNumber || 'XXXXX0000X' },
                profile: { category: 'services', subcategory: 'professional_services', addresses: { registered: { street1: provider.address || 'N/A', city: provider.city || 'N/A', state: 'N/A', postal_code: String(provider.pincode || '110001'), country: 'IN' } } },
            };
            const response = await axios.post('https://api.razorpay.com/v2/accounts', payload, { headers: razorpayHeaders(), timeout: 15000 });
            provider.razorpayAccountId = response.data.id;
            await provider.save();
            return res.json({ success: true, message: 'Payout account activated!', data: { razorpayAccountId: response.data.id, status: 'active' } });
        } catch (razorpayErr) {
            const localId = `local_pending_${provider._id.toString().slice(-8)}`;
            provider.razorpayAccountId = localId;
            await provider.save();
            return res.json({ success: true, message: 'Bank details saved. Manual payouts enabled — auto-split requires Razorpay Route approval.', data: { razorpayAccountId: localId, status: 'pending_activation' } });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ────────────────────────────────────────────────────
// 3. Get Provider's bank & payout info
// ────────────────────────────────────────────────────
export const getBankDetails = async (req, res) => {
    try {
        const provider = await Provider.findOne({ user: req.user.id }).select('bankDetails payoutMethod razorpayAccountId');
        if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });
        res.json({ success: true, data: { bankDetails: provider.bankDetails, payoutMethod: provider.payoutMethod, razorpayAccountId: provider.razorpayAccountId } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ────────────────────────────────────────────────────
// 4. Get provider's earnings + payout history
// ────────────────────────────────────────────────────
export const getProviderEarnings = async (req, res) => {
    try {
        const provider = await Provider.findOne({ user: req.user.id });
        if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

        const payouts = await Payout.find({ provider: provider._id })
            .populate('booking', 'totalPrice platformFee providerEarning scheduledDate problemItems')
            .sort({ createdAt: -1 });

        const totalEarnings = payouts.reduce((s, p) => s + (p.amount || 0), 0);
        const totalPaid = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);
        const totalPending = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0);

        res.json({
            success: true,
            data: {
                totalEarnings, totalPaid, totalPending,
                completedJobs: payouts.length,
                payouts: payouts.map(p => ({
                    _id: p._id,
                    amount: p.amount,
                    platformFee: p.platformFee,
                    status: p.status,
                    paidAt: p.paidAt,
                    paymentMode: p.paymentMode,
                    transactionRef: p.transactionRef,
                    adminNote: p.adminNote,
                    date: p.createdAt,
                    booking: p.booking,
                })),
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ═══════════════════════════════════════════════════
// ADMIN PAYOUT MANAGEMENT
// ═══════════════════════════════════════════════════

// ────────────────────────────────────────────────────
// 5. Get all payouts (Admin)
// ────────────────────────────────────────────────────
export const getAllPayouts = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = status && status !== 'all' ? { status } : {};

        const payouts = await Payout.find(filter)
            .populate({ path: 'provider', select: 'ownerName businessName email bankDetails payoutMethod razorpayAccountId phone' })
            .populate({ path: 'booking', select: 'totalPrice platformFee providerEarning scheduledDate razorpayPaymentId paymentStatus' })
            .populate({ path: 'paidBy', select: 'name email' })
            .sort({ createdAt: -1 });

        const stats = {
            totalPending: payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
            totalPaid: payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
            pendingCount: payouts.filter(p => p.status === 'pending').length,
            paidCount: payouts.filter(p => p.status === 'paid').length,
        };

        res.json({ success: true, data: payouts, stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ────────────────────────────────────────────────────
// 6. Mark a payout as PAID (Admin)
// ────────────────────────────────────────────────────
export const markPayoutPaid = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { paymentMode, transactionRef, adminNote } = req.body;

        const payout = await Payout.findById(payoutId).populate('provider', 'ownerName email');
        if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
        if (payout.status === 'paid') return res.status(400).json({ success: false, message: 'Already marked as paid' });

        payout.status = 'paid';
        payout.paidAt = new Date();
        payout.paidBy = req.user.id;
        payout.paymentMode = paymentMode || 'bank_transfer';
        payout.transactionRef = transactionRef || '';
        payout.adminNote = adminNote || '';
        await payout.save();

        res.json({ success: true, message: `Payout of ₹${payout.amount} marked as paid to ${payout.provider?.ownerName}`, data: payout });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ────────────────────────────────────────────────────
// 7. Mark payout on hold (Admin)
// ────────────────────────────────────────────────────
export const holdPayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { adminNote } = req.body;

        const payout = await Payout.findById(payoutId);
        if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });

        payout.status = 'on_hold';
        payout.adminNote = adminNote || '';
        await payout.save();

        res.json({ success: true, message: 'Payout placed on hold', data: payout });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ────────────────────────────────────────────────────
// 8. Get payout summary stats (Admin Dashboard widget)
// ────────────────────────────────────────────────────
export const getPayoutStats = async (req, res) => {
    try {
        const [pending, paid, onHold] = await Promise.all([
            Payout.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
            Payout.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
            Payout.aggregate([{ $match: { status: 'on_hold' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
        ]);
        res.json({
            success: true,
            data: {
                pending: { amount: pending[0]?.total || 0, count: pending[0]?.count || 0 },
                paid: { amount: paid[0]?.total || 0, count: paid[0]?.count || 0 },
                onHold: { amount: onHold[0]?.total || 0, count: onHold[0]?.count || 0 },
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ════════════════════════════════════════════════════
// WEEKLY PAYOUT SETTLEMENT
// ════════════════════════════════════════════════════

// Helper: get week date range
const getWeekRange = (week) => {
    const now = new Date();
    let startOfWeek, endOfWeek;
    if (week === 'prev') {
        const lastMonday = new Date(now);
        lastMonday.setDate(now.getDate() - now.getDay() - 6);
        lastMonday.setHours(0, 0, 0, 0);
        startOfWeek = lastMonday;
        endOfWeek = new Date(lastMonday);
        endOfWeek.setDate(lastMonday.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
    } else {
        const monday = new Date(now);
        const day = now.getDay();
        monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
        monday.setHours(0, 0, 0, 0);
        startOfWeek = monday;
        endOfWeek = new Date(monday);
        endOfWeek.setDate(monday.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
    }
    return { startOfWeek, endOfWeek };
};

// 9. Weekly Payout Summary grouped by provider (Admin)
export const getWeeklySummary = async (req, res) => {
    try {
        const { week } = req.query;
        const { startOfWeek, endOfWeek } = getWeekRange(week);

        const payouts = await Payout.find({
            status: { $in: ['pending', 'on_hold'] },
            createdAt: { $gte: startOfWeek, $lte: endOfWeek },
        })
            .populate({ path: 'provider', select: 'ownerName businessName email phone bankDetails payoutMethod' })
            .populate({ path: 'booking', select: 'totalPrice platformFee providerEarning scheduledDate' })
            .sort({ createdAt: -1 });

        // Group by provider
        const providerMap = {};
        for (const payout of payouts) {
            const pid = payout.provider?._id?.toString();
            if (!pid) continue;
            if (!providerMap[pid]) {
                providerMap[pid] = { provider: payout.provider, payouts: [], totalAmount: 0, totalPlatformFee: 0, jobCount: 0 };
            }
            providerMap[pid].payouts.push(payout);
            providerMap[pid].totalAmount += payout.amount || 0;
            providerMap[pid].totalPlatformFee += payout.platformFee || 0;
            providerMap[pid].jobCount += 1;
        }

        const providers = Object.values(providerMap);
        res.json({
            success: true,
            data: {
                weekStart: startOfWeek, weekEnd: endOfWeek,
                providerCount: providers.length,
                totalJobs: providers.reduce((s, p) => s + p.jobCount, 0),
                grandTotal: providers.reduce((s, p) => s + p.totalAmount, 0),
                providers,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 10. Bulk Pay — settle ALL pending payouts for ONE provider this week (Admin)
export const bulkPayProvider = async (req, res) => {
    try {
        const { providerId } = req.params;
        const { paymentMode, transactionRef, adminNote, week } = req.body;
        const { startOfWeek, endOfWeek } = getWeekRange(week);

        const pending = await Payout.find({
            provider: providerId,
            status: { $in: ['pending', 'on_hold'] },
            createdAt: { $gte: startOfWeek, $lte: endOfWeek },
        }).populate('provider', 'ownerName');

        if (!pending.length) return res.status(404).json({ success: false, message: 'No pending payouts for this provider this week' });

        const totalPaid = pending.reduce((s, p) => s + (p.amount || 0), 0);
        await Payout.updateMany(
            { _id: { $in: pending.map(p => p._id) } },
            { $set: { status: 'paid', paidAt: new Date(), paidBy: req.user.id, paymentMode: paymentMode || 'bank_transfer', transactionRef: transactionRef || '', adminNote: adminNote || `Weekly settlement - ${new Date().toLocaleDateString('en-IN')}` } }
        );

        res.json({
            success: true,
            message: `✅ ₹${totalPaid} settled for ${pending[0].provider?.ownerName} (${pending.length} jobs)`,
            data: { totalPaid, jobCount: pending.length },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 11. Bulk Pay ALL providers for the week at once (Admin)
export const bulkPayAllProviders = async (req, res) => {
    try {
        const { paymentMode, adminNote, week } = req.body;
        const { startOfWeek, endOfWeek } = getWeekRange(week);

        const allPending = await Payout.find({
            status: { $in: ['pending', 'on_hold'] },
            createdAt: { $gte: startOfWeek, $lte: endOfWeek },
        });

        if (!allPending.length) return res.status(404).json({ success: false, message: 'No pending payouts this week' });

        const grandTotal = allPending.reduce((s, p) => s + (p.amount || 0), 0);
        const providerCount = new Set(allPending.map(p => p.provider?.toString())).size;

        await Payout.updateMany(
            { _id: { $in: allPending.map(p => p._id) } },
            { $set: { status: 'paid', paidAt: new Date(), paidBy: req.user.id, paymentMode: paymentMode || 'bank_transfer', adminNote: adminNote || `Bulk weekly settlement - ${new Date().toLocaleDateString('en-IN')}` } }
        );

        res.json({
            success: true,
            message: `✅ ₹${grandTotal} settled to ${providerCount} providers (${allPending.length} jobs)`,
            data: { grandTotal, jobCount: allPending.length, providerCount },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
