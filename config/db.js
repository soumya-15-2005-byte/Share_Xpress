require('dotenv').config();
const mongoose = require('mongoose');

let cachedPromise = null;
let lastConnectionErrorTime = 0;
const RETRY_COOLDOWN_MS = 30000; // 30 seconds cooldown

async function connectDB() {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    const now = Date.now();
    if (now - lastConnectionErrorTime < RETRY_COOLDOWN_MS) {
        return mongoose.connection;
    }

    if (mongoose.connection.readyState === 2 && cachedPromise) {
        try {
            await cachedPromise;
            return mongoose.connection;
        } catch (err) {
            // Error is caught in the original connection attempt
        }
    }

    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI is not defined in .env file');
        return mongoose.connection;
    }

    try {
        mongoose.set('bufferCommands', false);
        cachedPromise = mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            connectTimeoutMS: 5000,         // Timeout initial connection after 5s
        });
        
        await cachedPromise;
        console.log('✅ Database connected 🥳🥳🥳🥳');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('💡 Please check your MONGO_URI in .env file');
        console.log('💡 Make sure your MongoDB Atlas cluster exists and is accessible');
        console.log('💡 Server will still start, but file operations will not work without database');
        lastConnectionErrorTime = Date.now();
        cachedPromise = null;
    }

    return mongoose.connection;
}

module.exports = connectDB;
