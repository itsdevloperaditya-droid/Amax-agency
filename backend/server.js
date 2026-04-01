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

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/amax_portfolio';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
  });

// Ensure Upload Directory Exists
const uploadDir = path.join(__dirname, 'uploads', 'videos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created upload directory:', uploadDir);
}

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// History Schema
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

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use(express.static(__dirname)); // Serve backend root for the hero video
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails')));
app.use('/video-editing samples', express.static(path.join(__dirname, 'video-editing samples')));

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
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Upload API
app.post('/api/upload', (req, res) => {
  upload.single('video')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer Error:', err);
      return res.status(400).json({ error: 'File too large (Max 100MB) or upload error.' });
    } else if (err) {
      console.error('Unknown Upload Error:', err);
      return res.status(500).json({ error: 'Internal server error during upload.' });
    }

    try {
      const { userName, service, budget, budgetDesc, fileSize } = req.body;
      if (!req.file) return res.status(400).json({ error: 'No video file uploaded.' });

      const fileName = req.file.filename;
      const filePath = `/uploads/videos/${fileName}`;

      const newHistory = new History({
        userName,
        service,
        budget,
        budgetDesc,
        fileName,
        filePath,
        fileSize
      });

      await newHistory.save();
      console.log('Project saved to history:', newHistory._id);

      res.status(201).json({ 
        message: 'Upload successful', 
        historyId: newHistory._id,
        filePath: filePath
      });
    } catch (dbErr) {
      console.error('Database Error:', dbErr);
      res.status(500).json({ error: 'Failed to save project data.' });
    }
  });
});

app.get('/api/history/:name', async (req, res) => {
  try {
    const history = await History.find({ userName: req.params.name }).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/video-view/:id', async (req, res) => {
  try {
    const item = await History.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch details' });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', name: user.name });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/media', (req, res) => {
  const videoDir = path.resolve(__dirname, 'video-editing samples');
  const thumbDir = path.resolve(__dirname, 'thumbnails');
  const getFiles = (dir, urlPrefix) => {
    try {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(file => !file.startsWith('.') && fs.statSync(path.join(dir, file)).isFile())
        .map(file => {
          const stats = fs.statSync(path.join(dir, file));
          return { name: file, path: `${urlPrefix}/${file}`, mtime: stats.mtime };
        })
        .sort((a, b) => b.mtime - a.mtime);
    } catch (err) { return []; }
  };
  res.json({ videos: getFiles(videoDir, 'video-editing samples'), thumbnails: getFiles(thumbDir, 'thumbnails') });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
