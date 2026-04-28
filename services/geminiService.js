import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analyzes call transcripts to extract structured information.
 * @param {Array} qaPairs - Array of { question, answer } objects
 * @returns {Promise<Object>} - Structured data and summary
 */
export const analyzeCallResponse = async (qaPairs) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const conversationText = qaPairs
            .map(pair => `Q: ${pair.question}\nA: ${pair.answer}`)
            .join('\n\n');

        const prompt = `
            You are an AI assistant for LocalFix, a home renovation platform.
            I will provide you with a transcript of a short qualification call (in Hindi/English).
            Your task is to:
            1. Clean up and translate the answers into clear English if they are in Hindi.
            2. Extract key details: Project Scope, Urgency, Budget Expectations, and Visit Availability.
            3. Provide a professional "Final Summary" that a service provider would read.

            Transcript:
            ${conversationText}

            Return the response in JSON format:
            {
                "cleanedAnswers": [ { "question": "...", "answer": "..." } ],
                "extractedDetails": {
                    "scope": "...",
                    "urgency": "...",
                    "budget": "...",
                    "availability": "..."
                },
                "finalSummary": "..."
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Extract JSON from the response (in case Gemini adds markdown blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        return { error: "Failed to parse JSON from AI", raw: text };
    } catch (error) {
        console.error("[Gemini Service] Error analyzing call:", error.message);
        return { error: error.message };
    }
};

/**
 * Cleans up a single speech-to-text response.
 * @param {string} speechText - The raw speech text from Twilio
 * @param {string} context - What was the question asked
 * @returns {Promise<string>} - Cleaned/Translated text
 */
export const cleanSpeechResponse = async (speechText, context) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            The user said the following in response to the question: "${context}"
            User Speech: "${speechText}"
            
            Please clean up this speech. If it's in Hindi (romanized or devanagari), keep the meaning but make it clear English. 
            If it's noise or irrelevant, return "Irrelevant". 
            Otherwise, return just the cleaned English response.
            No extra talk. Just the result.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("[Gemini Service] Error cleaning speech:", error.message);
        return speechText; // Fallback to raw text
    }
};
