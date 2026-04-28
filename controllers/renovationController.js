import { Renovation } from '../models/renovationSchema.js';
import { Provider } from '../models/providerSchema.js';
import { User } from '../models/userSchema.js';
import twilio from 'twilio';
import { analyzeCallResponse, cleanSpeechResponse } from '../services/geminiService.js';
const VoiceResponse = twilio.twiml.VoiceResponse;

// ─────────────────────────────────────────
// 1. Create a new Full House Renovation Request
// ─────────────────────────────────────────
export const createRenovationRequest = async (req, res) => {
  try {
    const customerId = req.user.id;
    const {
      projectTitle,
      description,
      estimatedBudget,
      propertyType,
      renovationType,
      projectScope,
      address,
      city,
      area,
      pincode,
      contactName,
      contactNumber,
      preferredStartDate,
      estimatedDuration,
      images
    } = req.body;

    const renovation = new Renovation({
      customer: customerId,
      projectTitle,
      description,
      estimatedBudget,
      propertyType,
      renovationType,
      projectScope: projectScope || [],
      address,
      city,
      area,
      pincode,
      contactName: contactName || req.user.name,
      contactNumber: contactNumber || '',
      preferredStartDate: preferredStartDate || new Date(),
      estimatedDuration,
      images: images || []
    });

    await renovation.save();

    // Trigger Twilio AI automated call
    import('../services/aiVoiceService.js').then(module => {
      module.triggerQualificationCall(renovation);
    });

    res.status(201).json({
      success: true,
      data: renovation
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────
// 2. Renovation Listing & Filtering
// ─────────────────────────────────────────
export const getAllRenovationRequests = async (req, res) => {
  try {
    const requests = await Renovation.find().populate('customer', 'name email').sort('-createdAt');
    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyRenovationRequests = async (req, res) => {
  try {
    const requests = await Renovation.find({ customer: req.user.id }).sort('-createdAt');
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAvailableRenovationRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const provider = await Provider.findOne({ user: userId });

    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    // Filter by provider's service areas
    const servicePincodes = provider.serviceAreas?.map(sa => sa.pincode) || [];
    if (provider.pincode) servicePincodes.push(provider.pincode);

    let query = { status: 'pending' };
    if (servicePincodes.length > 0) {
      query.pincode = { $in: servicePincodes };
    }

    const requests = await Renovation.find(query)
      .populate('customer', 'name email')
      .sort('-createdAt');

    // Filter out requests provider has already bid on
    const filtered = requests.filter(req => {
      return !req.responses.some(r => r.provider.toString() === provider._id.toString());
    });

    res.status(200).json({ success: true, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAcceptedRenovationRequests = async (req, res) => {
  try {
    const provider = await Provider.findOne({ user: req.user.id });
    const requests = await Renovation.find({
      provider: provider._id,
      status: { $in: ['accepted', 'in_progress', 'completed'] }
    }).populate('customer', 'name email contactNumber');
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────
// 4. Get Providers for Full House Renovation (with filters)
// ─────────────────────────────────────────
export const getAvailableProviders = async (req, res) => {
  try {
    const { city, area, pincode, rating, sortBy = '-rating' } = req.query;
    let query = { status: "approved" };

    if (city) query.city = { $regex: city, $options: 'i' };
    if (area) query.area = { $regex: area, $options: 'i' };
    if (pincode) {
      query.$or = [
        { pincode: pincode },
        { 'serviceAreas.pincode': pincode }
      ];
    }

    const providers = await Provider.find(query)
      .populate('user', 'name email')
      .sort(sortBy)
      .select('businessName phone city area pincode profilePhoto rating experience description serviceAreas');

    const providersWithRating = providers.map(p => ({
      ...p._doc,
      rating: p.rating || 4.5
    }));

    res.status(200).json({
      success: true,
      count: providersWithRating.length,
      data: providersWithRating
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const submitQuote = async (req, res) => {
  try {
    const { renovationRequestId } = req.params;
    const { quote, timeline } = req.body;
    const provider = await Provider.findOne({ user: req.user.id });

    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

    const request = await Renovation.findById(renovationRequestId);
    request.responses.push({ provider: provider._id, quote, timeline });
    request.quotesReceived = request.responses.length;
    await request.save();

    res.status(200).json({ success: true, message: 'Quote submitted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const acceptQuote = async (req, res) => {
  try {
    const { id, providerId } = req.params;
    const request = await Renovation.findById(id);

    request.responses.forEach(r => {
      r.status = r.provider.toString() === providerId ? 'accepted' : 'rejected';
    });

    request.provider = providerId;
    request.status = 'accepted';
    await request.save();

    res.status(200).json({ success: true, message: 'Quote accepted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRenovationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await Renovation.findByIdAndUpdate(id, { status, updatedAt: new Date() });
    res.status(200).json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRenovationRequest = async (req, res) => {
  try {
    const request = await Renovation.findById(req.params.id)
      .populate('customer', 'name email contactNumber')
      .populate('provider', 'businessName phone')
      .populate('responses.provider', 'businessName phone rating');
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rateRenovation = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review, ratedBy } = req.body;
    const request = await Renovation.findById(id);

    if (ratedBy === 'customer') {
      request.customerRating = rating;
      request.customerReview = review;
      await Provider.recalculateRating(request.provider);
    } else {
      request.providerRating = rating;
      request.providerReview = review;
    }

    await request.save();
    res.status(200).json({ success: true, message: 'Rated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelRenovationRequest = async (req, res) => {
  try {
    await Renovation.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.status(200).json({ success: true, message: 'Cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────
// 4. Diagnostics
// ─────────────────────────────────────────
export const getProviderDiagnostics = async (req, res) => {
  try {
    const provider = await Provider.findOne({ user: req.user.id });
    const totalPending = await Renovation.countDocuments({ status: 'pending' });
    res.status(200).json({
      success: true,
      diagnostic: {
        provider: { exists: !!provider },
        requests: { totalPending }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────
// 5. Twilio TwiML Flow (Hindi)
// ─────────────────────────────────────────
export const twimlInitial = async (req, res) => {
  try {
    console.log(`[Twilio Webhook] Received initial call for renovation ID: ${req.params.id}`);
    const { id } = req.params;

    // Clear previous data for a fresh call
    await Renovation.findByIdAndUpdate(id, {
      aiCallAnswers: [],
      aiCallStatus: 'pending'
    });

    const renovation = await Renovation.findById(id);
    const twiml = new VoiceResponse();
    const say = twiml.say({ voice: 'Polly.Aditi', language: 'hi-IN' });

    say.p('Namaste! Main LocalFix se bol rahi hoon.');
    say.p(`Aapne ghar ke "${renovation?.projectTitle || 'renovation'}" ke liye request bheji thi.`);
    say.p('Hume thodi aur jaankari chahiye. Kripya batayein ki aap gharmein kya kya kaam karwana chahte hain?');

    twiml.gather({
      input: 'speech',
      action: `/api/renovations/twiml/process/${id}?step=details`,
      language: 'hi-IN',
      speechTimeout: 'auto'
    });

    console.log(`[Twilio Webhook] Initial Script generated successfully!`);
    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    console.error('[TwiML Initial Error]:', err);
    res.status(500).send('Error');
  }
};

export const twimlProcess = async (req, res) => {
  try {
    console.log(`[Twilio Webhook] Received process step for renovation ID: ${req.params.id}`);
    const { id } = req.params;
    const { step } = req.query;
    const { SpeechResult } = req.body;

    const twiml = new VoiceResponse();
    const say = twiml.say({ voice: 'Polly.Aditi', language: 'hi-IN' });

    if (!SpeechResult || SpeechResult.length < 2) {
      say.p('Maaf kijiye, humne suna nahi. Kripya phir se batayein.');
      twiml.gather({
        input: 'speech',
        action: `/api/renovations/twiml/process/${id}?step=${step}`,
        language: 'hi-IN'
      });
    } else {
      let currentQuestionAsked = '';
      let nextStep = '';
      let nextQuestionPrompt = '';

      // 1. Identify what question we JUST asked to record the answer correctly
      if (step === 'details') {
        currentQuestionAsked = 'Ghar mein kya-kya kaam karwana hai?';
        nextStep = 'urgency';
        nextQuestionPrompt = 'Kya yeh kaam urgent hai ya aap kisi specific date par service chahte hain?';
      }
      else if (step === 'urgency') {
        currentQuestionAsked = 'Kya kaam urgent hai ya specific date par?';
        nextStep = 'budget';
        nextQuestionPrompt = 'Kya aapka koi approximate budget ya expectation hai is service ke liye?';
      }
      else if (step === 'budget') {
        currentQuestionAsked = 'Koi approximate budget ya expectation?';
        nextStep = 'time';
        nextQuestionPrompt = 'Ghar dekh kar budget discuss karne ke liye aapka free time kya hai? Kab visit schedule kar sakte hain?';
      }
      else if (step === 'time') {
        currentQuestionAsked = 'Visit schedule karne ka free time?';
        nextStep = 'finish';
      }

      // 2. Clean and Save the answer
      const cleanedAnswer = await cleanSpeechResponse(SpeechResult, currentQuestionAsked);
      
      if (cleanedAnswer.toLowerCase().includes('irrelevant')) {
        say.p('Maaf kijiye, main samajh nahi paayi. Kripya thoda vistaar mein batayein.');
        twiml.gather({
          input: 'speech',
          action: `/api/renovations/twiml/process/${id}?step=${step}`,
          language: 'hi-IN',
          speechTimeout: 'auto'
        });
        return res.type('text/xml').send(twiml.toString());
      }

      await Renovation.findByIdAndUpdate(id, {
        $push: { aiCallAnswers: { question: currentQuestionAsked, answer: cleanedAnswer } }
      });

      // 3. Handle transition
      if (nextStep === 'finish') {
        await Renovation.findByIdAndUpdate(id, { aiCallStatus: 'completed' });
        
        // Trigger AI analysis in background after finishing
        const updatedRenovation = await Renovation.findById(id);
        analyzeCallResponse(updatedRenovation.aiCallAnswers).then(async (analysis) => {
          if (!analysis.error) {
            await Renovation.findByIdAndUpdate(id, {
              aiCallSummary: analysis.finalSummary,
              // Optionally store cleaned answers if needed
              // aiCallAnswers: analysis.cleanedAnswers 
            });
            console.log(`[Gemini AI] Call analysis completed for ${id}`);
          }
        }).catch(err => console.error('[Gemini AI] Analysis failed:', err));

        say.p('Dhanyavaad! Hum aapki request process kar rahe hain. Jaldi hi ek professional aapse contact karega. Pranaam!');
        twiml.hangup();
      } else {
        say.p(nextQuestionPrompt);
        twiml.gather({
          input: 'speech',
          action: `/api/renovations/twiml/process/${id}?step=${nextStep}`,
          language: 'hi-IN',
          speechTimeout: 'auto'
        });
      }
    }

    console.log(`[Twilio Webhook] Process Script generated successfully!`);
    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    console.error('[TwiML Process Error]:', err);
    res.status(500).send('Error');
  }
};
