import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function testEmail() {
    console.log("Testing Email configuration...");
    console.log("Host:", process.env.EMAIL_HOST);
    console.log("User:", process.env.EMAIL_USER);

    try {
        await transporter.verify();
        console.log("SMTP Connection verified successfully!");

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: process.env.EMAIL_USER,
            subject: "LocalFix - SMTP Test",
            text: "This is a test email from LocalFix implementation.",
        });

        console.log("Test email sent:", info.messageId);
    } catch (error) {
        console.error("SMTP Test Failed:", error);
    }
}

testEmail();
