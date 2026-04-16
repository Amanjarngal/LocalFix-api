import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Helper to make axios POST with retries
 */
const axiosWithRetry = async (url, data, config, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.post(url, data, config);
    } catch (err) {
      const isRetryable = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED';
      if (i === retries || !isRetryable) throw err;
      console.warn(`Attempt ${i + 1} failed (${err.code}). Retrying in 1s...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

export const createOrder = async (req, res) => {
  try {
    const { amount, providerId } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, message: 'Amount is required' });
    }

    // Fetch Platform Fee from Settings
    const { Settings } = await import("../models/settingsSchema.js");
    let settings = await Settings.findOne();
    if (!settings) settings = { platformFee: 50, feeType: 'fixed' };

    let platformFee = 0;
    if (settings.feeType === 'fixed') {
        platformFee = settings.platformFee;
    } else {
        platformFee = Math.round(amount * (settings.platformFee / 100));
    }

    const totalAmount = Number(amount) + platformFee;
    const providerShare = Number(amount); // Provider gets service amount, platform keeps fee

    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');

    // Build order payload
    const orderPayload = {
      amount: totalAmount * 100, // amount in paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    // Check if provider has a Razorpay linked account for auto-split
    let autoSplit = false;
    if (providerId) {
      const { Provider } = await import("../models/providerSchema.js");
      const provider = await Provider.findById(providerId);
      if (provider && provider.razorpayAccountId) {
        // Add Razorpay Route transfer instructions
        orderPayload.transfers = [
          {
            account: provider.razorpayAccountId,
            amount: providerShare * 100, // provider's share in paise
            currency: 'INR',
            notes: {
              provider_name: provider.ownerName,
              provider_id: provider._id.toString(),
            },
            on_hold: 0,
          }
        ];
        autoSplit = true;
      }
    }

    const response = await axiosWithRetry('https://api.razorpay.com/v1/orders', orderPayload, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'LocalFix-Server/1.0'
      },
      timeout: 10000 
    });

    res.status(200).json({
      success: true,
      orderId: response.data.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      platformFee,
      totalAmount,
      providerShare,
      autoSplit,
    });
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      console.error('Razorpay Connectivity Error: DNS resolution failed (api.razorpay.com)');
      return res.status(503).json({
        success: false,
        message: 'Server cannot connect to Razorpay. Please check DNS settings.'
      });
    }

    if (error.code === 'ECONNRESET') {
      console.error('Razorpay Connectivity Error: Connection was reset by the peer/network.');
      return res.status(503).json({
        success: false,
        message: 'Connection to Razorpay was reset. This is usually caused by unstable internet or a firewall.'
      });
    }

    console.error('Razorpay Create Order Error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.error?.description || 'Could not create Razorpay order'
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      res.status(200).json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Razorpay Verify Error:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};
