// Re-trigger Vercel deployment to load env updates
require('dotenv').config();
const express = require('express');
const app = express();
app.enable('trust proxy');
const PORT = process.env.PORT || 3000;
const path = require('path');
const cors = require('cors');
// Cors 

app.use(cors())

// const corsOptions = {
//   origin: process.env.ALLOWED_CLIENTS.split(',')
//   ['http://localhost:3000', 'http://localhost:5500', 'http://localhost:3300']
// }

// Default configuration looks like
// {
//     "origin": "*",
//     "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
//     "preflightContinue": false,
//     "optionsSuccessStatus": 204
//   }

// app.use(express.static(path.join(__dirname,"./Frontend/public/index.html")))

// app.use(cors(corsOptions))
app.use(express.static(path.join(__dirname, 'public')));

const connectDB = require('./config/db');
const { dirname } = require('path');

// Connect to database on startup (non-blocking)
connectDB().catch(err => console.error('Database startup connection error:', err.message));

// Ensure database connection is initialized (non-blocking)
app.use((req, res, next) => {
    connectDB().catch(error => {
        console.error('Database middleware connection error:', error.message);
    });
    next();
});

app.use(express.json());

app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');

app.get("/",(req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
})

app.get("/api/db-status", (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    readyState: mongoose.connection.readyState
  });
});

// Routes 
app.use('/api/files', require('./routes/files'));
app.use('/files', require('./routes/show'));
app.use('/files/download', require('./routes/download'));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('💥 Unhandled Server Error:', err);
    res.status(500).json({
        error: 'Unhandled server error: ' + err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
});


if (require.main === module) {
  app.listen(PORT, console.log(`Listening on port ${PORT}.`));
}

module.exports = app;
