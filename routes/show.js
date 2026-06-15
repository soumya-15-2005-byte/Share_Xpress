const router = require('express').Router();
const File = require('../models/file');
const mongoose = require('mongoose');
const memoryStorage = require('../storage/memoryStorage');

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

router.get('/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid;
        console.log(`🔍 Looking for file with UUID: ${uuid}`);
        
        let file = null;
        
        // Try MongoDB first if connected
        if (mongoose.connection.readyState === 1) {
            try {
                file = await File.findOne({ uuid: uuid });
                if (file) {
                    console.log(`✅ File found in MongoDB: ${file.filename}`);
                } else {
                    console.log(`❌ File not found in MongoDB for UUID: ${uuid}`);
                }
            } catch (err) {
                console.error('Error fetching from MongoDB:', err.message);
            }
        } else {
            console.log('⚠️ MongoDB not connected, checking memory storage...');
        }
        
        // Fallback to memory storage
        if (!file) {
            file = memoryStorage.findFileByUuid(uuid);
            if (file) {
                console.log(`✅ File found in memory storage: ${file.filename}`);
            } else {
                console.log(`❌ File not found in memory storage for UUID: ${uuid}`);
            }
        }
        
        // Link expired or file not found
        if(!file) {
            console.log(`❌ File not found for UUID: ${uuid}`);
            return res.render('download', { error: 'Link has expired or file not found. Files on free hosting may be deleted after server restart.'});
        } 
        
        // Auto-detect base URL from request if not set in env
        const baseUrl = getBaseUrl(req);
        return res.render('download', { 
            uuid: file.uuid, 
            fileName: file.filename, 
            fileSize: file.size, 
            downloadLink: `${baseUrl}/files/download/${file.uuid}` 
        });
    } catch(err) {
        console.error('Error in show route:', err);
        return res.render('download', { error: 'Something went wrong. Please try again.'});
    }
});


module.exports = router;