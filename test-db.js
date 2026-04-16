import "dotenv/config";
import mongoose from "mongoose";

const testDb = async () => {
    try {
        console.log("Connecting to:", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Successfully connected to db!");
        process.exit(0);
    } catch (err) {
        console.error("Failed to connect to db:");
        console.error(err);
        process.exit(1);
    }
};

testDb();
