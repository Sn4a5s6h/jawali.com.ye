// index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const multer = require('multer');
const path = require('path');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 🗄️ قاعدة بيانات LowDB
const db = new Low(new JSONFile('db.json'), { users: [], messages: [] });
await db.read();
db.data ||= { users: [], messages: [] };
await db.write();

// ⚙️ ميدل وير
app.use(cors());
app.use(helmet()); // أمان إضافي
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// 📝 تسجيل مستخدم جديد
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const exists = db.data.users.find(u => u.username === username);
  if (exists) return res.status(400).json({ message: 'المستخدم موجود بالفعل' });

  const hashed = await bcrypt.hash(password, 10);
  db.data.users.push({ id: uuidv4(), username, password: hashed, online: false });
  await db.write();
  res.json({ success: true });
});

// 🔑 تسجيل الدخول
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.data.users.find(u => u.username === username);
  if (!user) return res.status(400).json({ message: 'المستخدم غير موجود' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'كلمة المرور خاطئة' });

  req.session.user = { id: user.id, username: user.username };
  user.online = true;
  await db.write();

  res.json({ success: true, redirect: '/chat.html' });
});

// 🚪 تسجيل الخروج
app.post('/logout', async (req, res) => {
  if (req.session.user) {
    const user = db.data.users.find(u => u.id === req.session.user.id);
    if (user) {
      user.online = false;
      await db.write();
    }
    req.session.destroy(() => {
      res.json({ success: true, redirect: '/login.html' });
    });
  } else {
    res.json({ success: true, redirect: '/login.html' });
  }
});

// 📂 رفع ملفات الوسائط
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ success: true, file: `/uploads/${req.file.filename}` });
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🔌 Socket.io
io.on('connection', (socket) => {
  console.log('📡 مستخدم متصل:', socket.id);

  // انضمام للغرفة
  socket.on('join_room', (roomID) => {
    socket.join(roomID);
    socket.to(roomID).emit('user_joined', socket.id);
  });

  // WebRTC signals
  socket.on('signal', ({ roomID, target, data }) => {
    if (target) {
      socket.to(target).emit('signal', { id: socket.id, data });
    } else {
      socket.to(roomID).emit('signal', { id: socket.id, data });
    }
  });

  // رسائل الدردشة
  socket.on('chat_message', async (msg) => {
    const message = { id: uuidv4(), ...msg, time: Date.now() };
    io.emit('chat_message', message);
    db.data.messages.push(message);
    await db.write();
  });

  // عند فصل المستخدم
  socket.on('disconnect', async () => {
    console.log('❌ مستخدم خرج:', socket.id);
    const user = db.data.users.find(u => u.socketId === socket.id);
    if (user) {
      user.online = false;
      await db.write();
    }
  });
});

// 🚀 بدء الخادم
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ الخادم يعمل على http://localhost:${PORT}`)); 
