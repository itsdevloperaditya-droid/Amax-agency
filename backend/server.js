require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const { readJSONBin, writeJSONBin } = require('./middleware/jsonbin');

const app = express();
const PORT = process.env.PORT || 3000;

// Database File Paths (Fallback)
const USERS_FILE = path.join(__dirname, 'users.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');

// Initialize Files if they don't exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');

// Determine which DB backend to use
let isMongoConnected = false;
let useJsonBin = !!(process.env.JSONBIN_API_KEY && process.env.JSONBIN_BIN_ID);

if (useJsonBin) {
  console.log('✅ Using JSONBin cloud storage for persistent data');
}

// MongoDB Connection (optional override)
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('✅ Successfully connected to MongoDB Atlas!');
      isMongoConnected = true;
      useJsonBin = false;
    })
    .catch(err => {
      console.error('❌ MongoDB Connection Error:', err.message);
      if (useJsonBin) console.log('✅ Falling back to JSONBin cloud storage.');
      else console.log('⚠️ Falling back to Local JSON Database.');
    });
} else if (!useJsonBin) {
  console.log('⚠️ No MONGODB_URI or JSONBIN found. Using Local JSON Database (data will be lost on restart).');
}

// Ensure Upload Directory Exists
const uploadDir = path.join(__dirname, 'uploads', 'videos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Mongoose Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const historySchema = new mongoose.Schema({
  userName: { type: String, required: true },
  service: { type: String, required: true },
  budget: { type: String },
  budgetDesc: { type: String },
  fileName: { type: String },
  filePath: { type: String },
  fileSize: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const History = mongoose.model('History', historySchema);

// JSON DB Helper Functions
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// Middleware
app.use(cors({ origin: 'https://amax-gr31.onrender.com', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Routes
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=60');
  }
}));
app.use('/video-editing-samples', express.static(path.join(__dirname, 'video-editing samples'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.ogg')) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=60');
    }
    if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.gif') || filePath.endsWith('.webp')) {
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=60');
    }
  }
}));

// Serve specific hero video safely
app.get('/WhatsApp%20Video%202026-03-30%20at%2012.46.06.mp4', (req, res) => {
  res.sendFile(path.join(__dirname, 'WhatsApp Video 2026-03-30 at 12.46.06.mp4'));
});



// UPLOAD & HISTORY
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    const { userName, service, budget, budgetDesc, fileSize } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded.' });

    const fileName = req.file.filename;
    const filePath = `/uploads/videos/${fileName}`;

    if (isMongoConnected) {
      const newHistory = new History({ userName, service, budget, budgetDesc, fileName, filePath, fileSize });
      await newHistory.save();
    } else if (useJsonBin) {
      let history = await readJSONBin('history');
      history.push({ userName, service, budget, budgetDesc, fileName, filePath, fileSize, createdAt: new Date() });
      await writeJSONBin('history', history);
    } else {
      const history = readJSON(HISTORY_FILE);
      history.push({ userName, service, budget, budgetDesc, fileName, filePath, fileSize, createdAt: new Date() });
      writeJSON(HISTORY_FILE, history);
    }

    res.status(201).json({ message: 'Upload successful', filePath });
  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: 'Failed to save project data.' });
  }
});

app.get('/api/history/:name', async (req, res) => {
  try {
    if (isMongoConnected) {
      const history = await History.find({ userName: req.params.name }).sort({ createdAt: -1 });
      res.json(history);
    } else if (useJsonBin) {
      const history = await readJSONBin('history');
      res.json(history.filter(h => h.userName === req.params.name).reverse());
    } else {
      const history = readJSON(HISTORY_FILE);
      res.json(history.filter(h => h.userName === req.params.name).reverse());
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/media', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const videoDir = path.resolve(__dirname, 'video-editing samples');
  const thumbDir = path.resolve(__dirname, 'thumbnails');
  const getFiles = (dir, urlPrefix) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(file => !file.startsWith('.') && fs.statSync(path.join(dir, file)).isFile())
      .map(file => ({ name: file, path: `${urlPrefix}/${encodeURIComponent(file)}`, mtime: fs.statSync(path.join(dir, file)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
  };
  res.json({ videos: getFiles(videoDir, 'video-editing-samples'), thumbnails: getFiles(thumbDir, 'thumbnails') });
});

app.get('/api/video-view/:id', async (req, res) => {
  try {
    if (isMongoConnected) {
      const entry = await History.findById(req.params.id);
      if (!entry) return res.status(404).json({ error: 'Not found' });
      return res.json(entry);
    } else {
      const history = readJSON(HISTORY_FILE);
      const entry = history.find(h => h._id === req.params.id);
      if (!entry) return res.status(404).json({ error: 'Not found' });
      return res.json(entry);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

const chatRoute = require('./routes/chat');
app.use(chatRoute);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
