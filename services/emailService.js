import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Send an email to the provider when they submit an application.
 */
export const sendApplicationReceivedEmail = async (providerEmail, providerName) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: providerEmail,
            subject: "Application Received - LocalFix",
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>Hello ${providerName},</h2>
                    <p>Thank you for applying to be a service provider on <strong>LocalFix</strong>.</p>
                    <p>We have received your application and our team is currently reviewing it. We will notify you once a decision has been made.</p>
                    <p>Best regards,<br/>The LocalFix Team</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error sending application received email:", error);
    }
};

/**
 * Send an email to the provider when their application is approved.
 */
export const sendApplicationApprovedEmail = async (providerEmail, providerName, credentials = null) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: providerEmail,
            subject: "Application Approved - LocalFix",
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #4CAF50;">Congratulations ${providerName}!</h2>
                    <p>Your application to be a service provider on <strong>LocalFix</strong> has been <strong>approved</strong>.</p>
                    ${credentials ? `
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin: 20px 0;">
                        <p style="margin-top: 0;"><strong>Your Login Credentials:</strong></p>
                        <p><strong>Email:</strong> ${providerEmail}</p>
                        <p><strong>Temporary Password:</strong> ${credentials.password}</p>
                        <p style="color: #e67e22; font-size: 0.9em;"><em>Note: You will be required to set a new password upon your first login for security.</em></p>
                    </div>
                    ` : ''}
                    <p>You can now log in to your dashboard and start accepting service requests.</p>
                    <p>Best regards,<br/>The LocalFix Team</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error sending application approved email:", error);
    }
};

/**
 * Send an email to the provider when their application is rejected.
 */
export const sendApplicationRejectedEmail = async (providerEmail, providerName, reason = "") => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: providerEmail,
            subject: "Application Update - LocalFix",
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>Hello ${providerName},</h2>
                    <p>Thank you for your interest in joining <strong>LocalFix</strong>.</p>
                    <p>After reviewing your application, we regret to inform you that we cannot approve it at this time.</p>
                    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
                    <p>If you have any questions, please feel free to contact our support team.</p>
                    <p>Best regards,<br/>The LocalFix Team</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error sending application rejected email:", error);
    }
};
