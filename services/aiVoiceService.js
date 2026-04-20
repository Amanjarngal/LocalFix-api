import twilio from 'twilio';

/**
 * Service to handle AI Voice Calls using Twilio
 * This initiates the call and points it to our TwiML logic for conversation.
 */

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;
const BACKEND_URL = process.env.BACKEND_URL || 'https://your-domain.com'; // Must be public for Twilio

const client = twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);

/**
 * Triggers an AI voice call to the customer via Twilio
 * @param {Object} renovation - The renovation request object
 */
export const triggerQualificationCall = async (renovation) => {
    try {
        if (!TWILIO_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) {
            console.warn('[Twilio AI] Twilio credentials missing. Skipping call.');
            return;
        }

        const formattedNumber = renovation.contactNumber.startsWith('+') 
            ? renovation.contactNumber 
            : `+91${renovation.contactNumber}`;

        console.log(`[Twilio AI] Initiating call to ${formattedNumber} for project: ${renovation.projectTitle}`);

        const baseUrl = BACKEND_URL.replace(/\/+$/, '');
        const call = await client.calls.create({
            method: 'POST',
            url: `${baseUrl}/api/renovations/twiml/initial/${renovation._id}`,
            to: formattedNumber,
            from: TWILIO_PHONE,
        });

        console.log(`[Twilio AI] Call initiated successfully. Call SID: ${call.sid}`);

        // Track initiation in DB
        await renovation.constructor.findByIdAndUpdate(renovation._id, {
            aiCallStatus: 'pending',
            aiCallId: call.sid
        });

        return call;
    } catch (error) {
        console.error('[Twilio AI] Error triggering call:', error.message);
        
        // Track failure in DB
        await renovation.constructor.findByIdAndUpdate(renovation._id, {
            aiCallStatus: 'failed'
        });
    }
};
