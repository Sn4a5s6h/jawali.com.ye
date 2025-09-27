import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// إعداد قاعدة بيانات LowDB
const db = new Low(new JSONFile('db.json'));
await db.read();
db.data ||= { users: [], messages: [] };
await db.write();

// ميدل وير
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// تسجيل مستخدم جديد
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const exists = db.data.users.find(u => u.username === username);
  if (exists) return res.status(400).json({ message: 'المستخدم موجود بالفعل' });

  const hashed = await bcrypt.hash(password, 10);
  db.data.users.push({ username, password: hashed });
  await db.write();
  res.json({ success: true });
});

// تسجيل الدخول
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.data.users.find(u => u.username === username);
  if (!user) return res.status(400).json({ message: 'المستخدم غير موجود' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'كلمة المرور خاطئة' });

  req.session.user = { username };
  res.json({ success: true, redirect: '/chat.html' });
});

// رفع ملفات الوسائط
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ success: true, file: `/uploads/${req.file.filename}` });
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io
io.on('connection', (socket) => {
  console.log('مستخدم متصل:', socket.id);

  socket.on('join_room', (roomID) => {
    socket.join(roomID);
    socket.to(roomID).emit('user_joined', socket.id);
  });

  socket.on('signal', ({ roomID, target, data }) => {
    if (target) {
      socket.to(target).emit('signal', { id: socket.id, data });
    } else {
      socket.to(roomID).emit('signal', { id: socket.id, data });
    }
  });

  socket.on('chat_message', (msg) => {
    io.emit('chat_message', msg);
    db.data.messages.push(msg);
    db.write();
  });

  socket.on('disconnect', () => {
    console.log('مستخدم خرج:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ الخادم يعمل على http://localhost:${PORT}`));
