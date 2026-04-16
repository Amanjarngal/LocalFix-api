import mongoose from "mongoose";

export const connectdb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("connected to db!", mongoose.connection.name);
  } catch (err) {
    console.log("error connecting to db!", err.message);
    throw err;
  }
};
