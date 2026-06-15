const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const File = require('../models/file');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const memoryStorage = require('../storage/memoryStorage');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'uploads');
if (!process.env.VERCEL && !fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

function getBaseUrl(req) {
  if (process.env.APP_BASE_URL && !process.env.APP_BASE_URL.includes('localhost') && !process.env.APP_BASE_URL.includes('127.0.0.1')) {
    return process.env.APP_BASE_URL;
  }
  
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  let host = req.get('host') || 'localhost:3000';
  
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp !== 'localhost') break;
    }
    const port = host.split(':')[1] || '3000';
    host = `${localIp}:${port}`;
  }
  return `${protocol}://${host}`;
}

let storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir) ,
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
              cb(null, uniqueName)
    } ,
});

let upload = multer({ storage, limits:{ fileSize: 1000000 * 100 }, }).single('myfile'); //100mb

router.post('/', (req, res) => {
    try {
        upload(req, res, async (err) => {
            try {
                if (err) {
                    console.error('Multer error:', err);
                    return res.status(500).send({ error: 'Multer error: ' + err.message });
                }
                
                if (!req.file) {
                    return res.status(400).send({ error: 'No file uploaded.' });
                }
                
                const uuid = uuidv4();
                const fileData = {
                    filename: req.file.filename,
                    uuid: uuid,
                    path: req.file.path,
                    size: req.file.size
                };
                
                // Auto-detect base URL from request if not set in env
                const baseUrl = getBaseUrl(req);
                console.log(`🌐 Resolved base URL: ${baseUrl}`);
                
                // Try to save to MongoDB if connected, otherwise use memory storage
                if (mongoose.connection.readyState === 1) {
                    try {
                        const fileDataDb = {
                            ...fileData,
                            buffer: fs.readFileSync(req.file.path),
                            contentType: req.file.mimetype
                        };
                        const file = new File(fileDataDb);
                        const response = await file.save();
                        
                        // Clean up temp file
                        try {
                            fs.unlinkSync(req.file.path);
                        } catch (unlinkErr) {
                            console.error('Failed to clean up temp file:', unlinkErr.message);
                        }
                        
                        return res.json({ file: `${baseUrl}/files/${response.uuid}`, uuid: response.uuid });
                    } catch (error) {
                        console.error('Error saving to MongoDB, using memory storage:', error.message);
                        // Fall through to memory storage
                    }
                } else {
                    console.log('📦 MongoDB not connected, using in-memory storage for testing');
                }
                
                // Use in-memory storage as fallback
                try {
                    memoryStorage.saveFile(fileData);
                    console.log(`✅ File saved to memory storage: ${uuid}`);
                    return res.json({ file: `${baseUrl}/files/${uuid}`, uuid: uuid });
                } catch (error) {
                    console.error('Error saving file to memory storage:', error);
                    return res.status(500).send({ 
                        error: 'Failed to save file information. ' + error.message 
                    });
                }
            } catch (innerErr) {
                console.error('Inner upload route error:', innerErr);
                return res.status(500).send({ error: 'Internal server upload error: ' + innerErr.message });
            }
        });
    } catch (outerErr) {
        console.error('Outer upload route error:', outerErr);
        return res.status(500).send({ error: 'Failed to initiate upload: ' + outerErr.message });
    }
});

router.post('/send', async (req, res) => {
  const { uuid, emailTo, emailFrom, expiresIn } = req.body;
  if(!uuid || !emailTo || !emailFrom) {
      return res.status(422).send({ error: 'All fields are required except expiry.'});
  }
  
  try {
    let file = null;
    let isInMemory = false;
    
    // Try MongoDB first if connected
    if (mongoose.connection.readyState === 1) {
      try {
        file = await File.findOne({ uuid: uuid });
      } catch (err) {
        console.error('Error fetching from MongoDB in send route:', err.message);
      }
    }
    
    // Fallback to memory storage
    if (!file) {
      file = memoryStorage.findFileByUuid(uuid);
      if (file) {
        isInMemory = true;
      }
    }
    
    if(!file) {
      return res.status(404).send({ error: 'File not found or link has expired.' });
    }
    
    if(file.sender) {
      return res.status(422).send({ error: 'Email already sent once.'});
    }
    
    // Update sender & receiver
    file.sender = emailFrom;
    file.receiver = emailTo;
    
    if (!isInMemory) {
      await file.save();
    }
    
    // send mail
    const sendMail = require('../services/mailService');
    
    
    // Auto-detect base URL for email links
    const emailBaseUrl = getBaseUrl(req);
    console.log(`✉️ Resolved base URL for email: ${emailBaseUrl}`);
    
    sendMail({
      from: emailFrom,
      to: emailTo,
      subject: 'inShare file sharing',
      text: `${emailFrom} shared a file with you.`,
      html: require('../services/emailTemplate')({
                emailFrom : emailFrom, 
                downloadLink: `${emailBaseUrl}/files/${file.uuid}?source=email` ,
                size: parseInt(file.size/1000) + ' KB',
                expires: '24 hours'
            })
    }).then(() => {
      return res.json({success: true});
    }).catch(err => {
      console.error('Email service failed:', err.message);
      return res.status(500).json({error: 'Error in email sending.'});
    });
  } catch(err) {
    console.error('Error in send route:', err);
    return res.status(500).send({ error: 'Something went wrong.'});
  }
});

module.exports = router;