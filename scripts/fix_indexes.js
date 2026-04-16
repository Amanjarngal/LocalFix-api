import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const cleanIndexes = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('providers');

        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes);

        const userIndex = indexes.find(index => index.name === 'user_1');

        if (userIndex) {
            console.log('Found user_1 index. Dropping...');
            await collection.dropIndex('user_1');
            console.log('user_1 index dropped successfully.');
        } else {
            console.log('user_1 index not found.');
        }

        const updatedIndexes = await collection.indexes();
        console.log('Updated indexes:', updatedIndexes);

    } catch (error) {
        console.error('Error cleaning indexes:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

cleanIndexes();
