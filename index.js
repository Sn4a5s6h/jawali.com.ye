// =======================
// 📌 استيراد المكتبات
// =======================
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

// =======================
// 📌 تهيئة التطبيق
// =======================
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// =======================
// 📌 إعداد قاعدة بيانات LowDB
// =======================
const db = new Low(new JSONFile('db.json'));
async function initDB() {
  await db.read();
  db.data ||= { users: [], messages: [] };
  await db.write();
}
initDB();

// =======================
// 📌 ميدل وير
// =======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

// تقديم الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =======================
// 📌 نظام المستخدمين (تسجيل/دخول)
// =======================
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  const exists = db.data.users.find(u => u.username === username);
  if (exists) return res.status(400).json({ message: 'المستخدم موجود بالفعل' });

  const hashed = await bcrypt.hash(password, 10);
  db.data.users.push({ username, password: hashed, online: false });
  await db.write();

  res.json({ success: true });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = db.data.users.find(u => u.username === username);
  if (!user) return res.status(400).json({ message: 'المستخدم غير موجود' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'كلمة المرور خاطئة' });

  req.session.user = { username };
  user.online = true;
  await db.write();

  res.json({ success: true, redirect: '/chat.html' });
});

app.post('/logout', async (req, res) => {
  if (req.session.user) {
    const user = db.data.users.find(u => u.username === req.session.user.username);
    if (user) {
      user.online = false;
      await db.write();
    }
    req.session.destroy();
  }
  res.json({ success: true, redirect: '/' });
});

// =======================
// 📌 رفع الوسائط (صور/ملفات)
// =======================
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ success: true, file: `/uploads/${req.file.filename}` });
});

// =======================
// 📌 Socket.IO (مكالمات + رسائل)
// =======================
io.on('connection', (socket) => {
  console.log('📡 مستخدم متصل:', socket.id);

  // الانضمام لغرفة
  socket.on('join_room', (roomID) => {
    socket.join(roomID);
    socket.to(roomID).emit('user_joined', socket.id);
  });

  // WebRTC signaling
  socket.on('signal', ({ roomID, target, data }) => {
    if (target) {
      socket.to(target).emit('signal', { id: socket.id, data });
    } else {
      socket.to(roomID).emit('signal', { id: socket.id, data });
    }
  });

  // الرسائل النصية
  socket.on('chat_message', async (msg) => {
    io.emit('chat_message', msg);
    db.data.messages.push(msg);
    await db.write();
  });

  // عند الخروج
  socket.on('disconnect', () => {
    console.log('❌ مستخدم خرج:', socket.id);
  });
});

// =======================
// 📌 تشغيل الخادم
// =======================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ الخادم يعمل على http://localhost:${PORT}`));
