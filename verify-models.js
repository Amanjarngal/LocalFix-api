
import mongoose from "mongoose";
import { Service, Problem } from "./models/serviceSchema.js"; // Adjust path as needed

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected");
    } catch (err) {
        console.error("MongoDB Connection Failed:", err.message);
        process.exit(1);
    }
};

const verifyModels = async () => {
    await connectDB();

    try {
        console.log("Creating Service...");
        const service = await Service.create({
            name: "Test Service " + Date.now(),
            description: "Test Description",
            icon: "TestIcon"
        });
        console.log("Service Created:", service);

        console.log("Creating Problem...");
        const problem = await Problem.create({
            service: service._id,
            title: "Test Problem",
            description: "Test Problem Description",
            price: 100
        });
        console.log("Problem Created:", problem);

        console.log("Fetching Problems for Service...");
        const problems = await Problem.find({ service: service._id });
        console.log("Problems Found:", problems.length);

        console.log("Cleaning up...");
        await Problem.deleteMany({ service: service._id });
        await Service.findByIdAndDelete(service._id);
        console.log("Cleanup Complete");

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        mongoose.connection.close();
    }
};

verifyModels();
