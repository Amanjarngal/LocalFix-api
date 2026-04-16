import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Provider } from './models/providerSchema.js';
import { Problem, Service } from './models/serviceSchema.js';

dotenv.config();

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const providers = await Provider.find();
    console.log('--- Providers ---');
    providers.forEach(p => {
      console.log(`ID: ${p._id}, Name: ${p.businessName}, Status: ${p.status}, Verified: ${p.verified}`);
    });

    const problems = await Problem.find().populate('service');
    console.log('\n--- Problems ---');
    problems.forEach(p => {
      console.log(`ID: ${p._id}, Title: ${p.title}, Service: ${p.service?.name}, Price: ${p.price}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDB();
