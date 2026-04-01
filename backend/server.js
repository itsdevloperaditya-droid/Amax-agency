require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Database File Paths (Fallback)
const USERS_FILE = path.join(__dirname, 'users.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');

// Initialize Files if they don't exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]');

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
let isMongoConnected = false;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('✅ Successfully connected to MongoDB Atlas!');
      isMongoConnected = true;
    })
    .catch(err => {
      console.error('❌ MongoDB Connection Error:', err.message);
      console.log('⚠️ Falling back to Local JSON Database.');
    });
} else {
  console.log('⚠️ No MONGODB_URI found. Using Local JSON Database.');
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
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails')));
app.use('/video-editing-samples', express.static(path.join(__dirname, 'video-editing samples')));

// Serve specific hero video safely
app.get('/WhatsApp%20Video%202026-03-30%20at%2012.46.06.mp4', (req, res) => {
  res.sendFile(path.join(__dirname, 'WhatsApp Video 2026-03-30 at 12.46.06.mp4'));
});

// AUTH ROUTES
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });

    const hashedPassword = await bcrypt.hash(password, 10);

    if (isMongoConnected) {
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ error: 'User already exists' });
      const newUser = new User({ name, email, password: hashedPassword });
      await newUser.save();
    } else {
      const users = readJSON(USERS_FILE);
      if (users.find(u => u.email === email)) return res.status(400).json({ error: 'User already exists' });
      users.push({ name, email, password: hashedPassword, createdAt: new Date() });
      writeJSON(USERS_FILE, users);
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Signup Error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user;

    if (isMongoConnected) {
      user = await User.findOne({ email });
    } else {
      const users = readJSON(USERS_FILE);
      user = users.find(u => u.email === email);
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    res.json({ message: 'Login successful', name: user.name });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ADMIN ROUTES
app.post('/api/admin/login', (req, res) => {
  const { id, password } = req.body;
  if (id === 'admin' && password === 'admin123') {
    res.json({ message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid admin credentials' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    if (isMongoConnected) {
      const users = await User.find().sort({ createdAt: -1 });
      res.json(users);
    } else {
      const users = readJSON(USERS_FILE);
      res.json(users.reverse());
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
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
    } else {
      const history = readJSON(HISTORY_FILE);
      res.json(history.filter(h => h.userName === req.params.name).reverse());
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/media', (req, res) => {
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

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
