// Trigger build to apply Vercel env variable updates
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

// Connect to database (non-blocking - server will start even if DB connection fails)
try {
    connectDB();
} catch (error) {
    console.error('Database connection error:', error.message);
}

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


app.listen(PORT, console.log(`Listening on port ${PORT}.`));
