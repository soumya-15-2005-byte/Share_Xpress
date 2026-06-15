require('dotenv').config();
const mongoose = require('mongoose');

async function connectDB() {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI is not defined in .env file');
        return;
    }

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        });
        console.log('✅ Database connected 🥳🥳🥳🥳');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('💡 Please check your MONGO_URI in .env file');
        console.log('💡 Make sure your MongoDB Atlas cluster exists and is accessible');
        console.log('💡 Server will still start, but file operations will not work without database');
    }

    return mongoose.connection;
}

module.exports = connectDB;
