import { Renovation } from '../models/renovationSchema.js';
import { Provider } from '../models/providerSchema.js';
import { User } from '../models/userSchema.js';

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

    if (!projectTitle || !description || !estimatedBudget || !propertyType || !renovationType || !address || !city || !area || !pincode) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

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
    await renovation.populate('customer', 'name email');

    res.status(201).json({
      success: true,
      message: 'Renovation request created successfully',
      data: renovation
    });
  } catch (error) {
    console.error('Error creating renovation request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create renovation request',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 2. Get all Renovation Requests (with filters for users)
// ─────────────────────────────────────────
export const getAllRenovationRequests = async (req, res) => {
  try {
    const { status, city, area, pincode, propertyType, renovationType, sortBy = '-createdAt' } = req.query;
    let query = {};

    if (status) query.status = status;
    if (city) query.city = { $regex: city, $options: 'i' };
    if (area) query.area = { $regex: area, $options: 'i' };
    if (pincode) query.pincode = pincode;
    if (propertyType) query.propertyType = propertyType;
    if (renovationType) query.renovationType = renovationType;

    const requests = await Renovation.find(query)
      .populate('customer', 'name email')
      .populate('provider', 'businessName phone city area rating')
      .sort(sortBy)
      .limit(50);

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching renovation requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch renovation requests',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 3. Get User's Renovation Requests
// ─────────────────────────────────────────
export const getMyRenovationRequests = async (req, res) => {
  try {
    const customerId = req.user.id;
    const requests = await Renovation.find({ customer: customerId })
      .populate('provider', 'businessName phone city area rating')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching user renovation requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your renovation requests',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 4. Get Providers for Full House Renovation (with filters)
// ─────────────────────────────────────────
export const getAvailableProviders = async (req, res) => {
  try {
    const { city, area, pincode, rating, sortBy = '-rating' } = req.query;
    let query = { isAvailable: true };

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

    // Auto-attach dummy rating if not available
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
    console.error('Error fetching providers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch providers',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 5. Get Single Renovation Request
// ─────────────────────────────────────────
export const getRenovationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Renovation.findById(id)
      .populate('customer', 'name email contactNumber')
      .populate('provider', 'businessName phone city area rating')
      .populate('responses.provider', 'businessName phone rating');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Renovation request not found' });
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error('Error fetching renovation request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch renovation request',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 6. Provider: Submit Quote for Renovation Request
// ─────────────────────────────────────────
export const submitQuote = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { renovationRequestId } = req.params;
    const { quote, timeline } = req.body;

    if (!quote || !timeline) {
      return res.status(400).json({ success: false, message: 'Quote and timeline are required' });
    }

    console.log(`[submitQuote] User ${userId} submitting quote for request ${renovationRequestId}`);

    // Find the provider profile
    let provider = await Provider.findOne({ user: userId });
    if (!provider) {
      console.log(`[submitQuote] Provider not found by user ID, trying by email...`);
      provider = await Provider.findOne({ email: userEmail });
    }

    if (!provider) {
      console.log(`[submitQuote] Provider profile not found for user ${userId}`);
      return res.status(404).json({ success: false, message: 'Provider profile not found. Please complete your provider registration.' });
    }

    console.log(`[submitQuote] Found provider profile: ${provider._id}`);

    const request = await Renovation.findById(renovationRequestId);
    if (!request) {
      console.log(`[submitQuote] Renovation request not found: ${renovationRequestId}`);
      return res.status(404).json({ success: false, message: 'Renovation request not found' });
    }

    // Check if provider already submitted a quote
    const existingResponse = request.responses.find(r => r.provider.toString() === provider._id.toString());
    if (existingResponse) {
      console.log(`[submitQuote] Provider already submitted quote for request ${renovationRequestId}`);
      return res.status(400).json({ success: false, message: 'You already submitted a quote for this request' });
    }

    // Add quote response using Provider profile ID
    request.responses.push({
      provider: provider._id,
      quote,
      timeline,
      status: 'pending'
    });
    request.quotesReceived = request.responses.length;

    await request.save();
    await request.populate('responses.provider', 'businessName phone rating');

    console.log(`[submitQuote] Quote submitted successfully. Now has ${request.responses.length} quotes`);

    res.status(200).json({
      success: true,
      message: 'Quote submitted successfully',
      data: request
    });
  } catch (error) {
    console.error('Error submitting quote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit quote',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 7. Customer: Accept Provider Quote
// ─────────────────────────────────────────
export const acceptQuote = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { renovationRequestId, providerId } = req.params;

    const request = await Renovation.findById(renovationRequestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Renovation request not found' });
    }

    if (request.customer.toString() !== customerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Find and accept the quote
    const responseIndex = request.responses.findIndex(r => r.provider.toString() === providerId);
    if (responseIndex === -1) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    // Accept this quote, reject others
    request.responses.forEach((r, idx) => {
      r.status = idx === responseIndex ? 'accepted' : 'rejected';
    });

    request.provider = providerId;
    request.status = 'accepted';
    request.finalQuote = request.responses[responseIndex].quote;
    request.finalTimeline = request.responses[responseIndex].timeline;

    await request.save();
    await request.populate('provider', 'businessName phone email');

    res.status(200).json({
      success: true,
      message: 'Quote accepted successfully',
      data: request
    });
  } catch (error) {
    console.error('Error accepting quote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept quote',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 8. Provider: Get Available Renovation Requests
// ─────────────────────────────────────────
export const getAvailableRenovationRequests = async (req, res) => {
  try {
    const providerId = req.user.id;
    const providerEmail = req.user.email;

    console.log(`\n╔════════════════════════════════════════════════════╗`);
    console.log(`║ getAvailableRenovationRequests - Provider: ${providerId.slice(-4)}`);
    console.log(`╚════════════════════════════════════════════════════╝\n`);

    // STEP 1: Find provider profile (try by user ID first, then by email)
    console.log(`[Step 1] Looking for provider profile...`);
    let provider = await Provider.findOne({ user: providerId }).select('_id user email city area pincode serviceAreas');
    
    if (!provider) {
      console.log(`  ⚠️  Provider not found by user ID, trying by email...`);
      provider = await Provider.findOne({ email: providerEmail }).select('_id user email city area pincode serviceAreas');
    }

    if (!provider) {
      console.log(`  ❌  Provider not found!`);
      return res.status(404).json({ 
        success: false, 
        message: 'Provider profile not found. Please complete your provider registration first.',
        debug: { userId: providerId, email: providerEmail }
      });
    }

    console.log(`  ✅ Found provider: ${provider._id}`);
    console.log(`     Email: ${provider.email}`);
    console.log(`     Has service areas: ${provider.serviceAreas?.length > 0 ? 'Yes (' + provider.serviceAreas.length + ')' : 'No'}`);

    // STEP 2: Get all PENDING renovation requests
    console.log(`\n[Step 2] Fetching all pending renovation requests...`);
    const allRequests = await Renovation.find({ status: 'pending' })
      .populate('customer', 'name email')
      .sort('-createdAt');
    
    console.log(`  ✅ Found ${allRequests.length} total pending requests`);

    // STEP 3: Filter requests based on provider's service areas
    let filteredRequests = allRequests;
    
    let servicePincodes = provider.serviceAreas ? provider.serviceAreas.map(sa => sa.pincode) : [];
    
    // Always include provider's primary pincode
    if (provider.pincode) {
      servicePincodes.push(provider.pincode.toString());
    }

    // Remove duplicates
    servicePincodes = [...new Set(servicePincodes)];
    
    if (servicePincodes.length > 0) {
      console.log(`\n[Step 3] Filtering by ${servicePincodes.length} service area pincodes: ${servicePincodes.join(', ')}`);
      
      filteredRequests = allRequests.filter(req => servicePincodes.includes(req.pincode));
      console.log(`  ✅ After filtering: ${filteredRequests.length} matching requests`);
    } else {
      console.log(`\n[Step 3] No service areas configured - showing all pending requests`);
      console.log(`  💡 Provider can see all requests and choose which ones to bid on`);
    }

    // [Step 3.5] Filter out requests the provider has ALREADY submitted a quote for
    filteredRequests = filteredRequests.filter(req => {
      const hasBid = req.responses && req.responses.some(r => r.provider && r.provider.toString() === provider._id.toString());
      return !hasBid;
    });

    // STEP 4: Return results
    console.log(`\n[Step 4] Response ready: ${filteredRequests.length} requests`);
    console.log(`╔════════════════════════════════════════════════════╗\n`);

    res.status(200).json({
      success: true,
      count: filteredRequests.length,
      data: filteredRequests,
      debug: {
        providerId: provider._id,
        totalPending: allRequests.length,
        serviceAreasConfigured: provider.serviceAreas?.length > 0,
        filtered: filteredRequests.length
      }
    });
  } catch (error) {
    console.error('\n❌ Error in getAvailableRenovationRequests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available requests',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 9. Provider: Get Accepted Renovation Requests
// ─────────────────────────────────────────
export const getAcceptedRenovationRequests = async (req, res) => {
  try {
    const providerId = req.user.id;
    const requests = await Renovation.find({
      provider: providerId,
      status: { $in: ['accepted', 'in_progress', 'completed'] }
    })
      .populate('customer', 'name email contactNumber')
      .sort('-updatedAt');

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching accepted renovation requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch accepted requests',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 10. Update Renovation Status
// ─────────────────────────────────────────
export const updateRenovationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const request = await Renovation.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true }
    ).populate('customer provider', 'name email businessName');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Renovation request not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: request
    });
  } catch (error) {
    console.error('Error updating renovation status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 11. Rate Renovation Project
// ─────────────────────────────────────────
export const rateRenovation = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review, ratedBy } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const request = await Renovation.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Renovation request not found' });
    }

    if (ratedBy === 'customer') {
      request.customerRating = rating;
      request.customerReview = review || '';
    } else if (ratedBy === 'provider') {
      request.providerRating = rating;
      request.providerReview = review || '';
    }

    await request.save();

    res.status(200).json({
      success: true,
      message: 'Rating submitted successfully',
      data: request
    });
  } catch (error) {
    console.error('Error rating renovation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// 12. Cancel Renovation Request
// ─────────────────────────────────────────
export const cancelRenovationRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Renovation.findByIdAndUpdate(
      id,
      { status: 'cancelled', updatedAt: new Date() },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ success: false, message: 'Renovation request not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Renovation request cancelled successfully',
      data: request
    });
  } catch (error) {
    console.error('Error cancelling renovation request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel request',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────
// DIAGNOSTIC ENDPOINT
// ─────────────────────────────────────────
export const getProviderDiagnostics = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    console.log(`\n╔════════════════════════════════════════════════════╗`);
    console.log(`║ DIAGNOSTIC CHECK - Provider: ${userId.slice(-4)}`);
    console.log(`╚════════════════════════════════════════════════════╝\n`);

    // 1. Check provider profile
    console.log(`[1/5] Checking provider profile...`);
    let provider = await Provider.findOne({ user: userId });
    if (!provider) {
      provider = await Provider.findOne({ email: userEmail });
    }

    const providerInfo = provider ? {
      exists: true,
      id: provider._id,
      email: provider.email,
      businessName: provider.businessName,
      serviceAreas: provider.serviceAreas?.length || 0,
      pincodesServed: provider.serviceAreas?.map(sa => sa.pincode) || []
    } : { exists: false, email: userEmail };

    // 2. Count all pending requests
    console.log(`[2/5] Counting pending requests...`);
    const totalPending = await Renovation.countDocuments({ status: 'pending' });

    // 3. Get sample requests
    console.log(`[3/5] Fetching sample requests...`);
    const sampleRequests = await Renovation.find({ status: 'pending' })
      .select('_id projectTitle city pincode estimatedBudget')
      .limit(10);

    // 4. Check for quotes from this provider
    console.log(`[4/5] Checking for provider quotes...`);
    let providerQuotes = 0;
    if (provider) {
      const hasQuotes = await Renovation.countDocuments({
        'responses.provider': provider._id
      });
      providerQuotes = hasQuotes;
    }

    // 5. Check user role
    console.log(`[5/5] Checking user role...`);
    const user = await User.findById(userId).select('role email');

    console.log(`\n✅ Diagnostic complete!\n`);

    res.status(200).json({
      success: true,
      diagnostic: {
        timestamp: new Date(),
        user: {
          id: userId,
          email: userEmail,
          role: user?.role
        },
        provider: providerInfo,
        requests: {
          totalPending,
          sampleRequests: sampleRequests.map(r => ({
            id: r._id,
            title: r.projectTitle,
            city: r.city,
            pincode: r.pincode,
            budget: r.estimatedBudget
          })),
          sampleCount: sampleRequests.length
        },
        providerActivity: {
          quotesSubmitted: providerQuotes
        }
      }
    });
  } catch (error) {
    console.error('Error in diagnostic:', error);
    res.status(500).json({
      success: false,
      message: 'Diagnostic check failed',
      error: error.message
    });
  }
};
