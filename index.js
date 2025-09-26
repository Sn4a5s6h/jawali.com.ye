// index.js
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { Low, JSONFile } = require('lowdb');
const { nanoid } = require('nanoid');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: "*" } });

/* -------------------- LowDB (file JSON) for users/data -------------------- */
const dbFile = path.join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data ||= { users: [], messages: [] }; // users: [{id, username, passHash, createdAt}], messages: []
  await db.write();
}
initDB();

/* -------------------- Middleware -------------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // secure=true only on HTTPS
}));

// serve static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

/* -------------------- Multer for file uploads -------------------- */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${nanoid(6)}-${file.originalname.replace(/\s+/g,'_')}`)
});
const upload = multer({ storage });

/* -------------------- Auth routes -------------------- */
// register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'username & password required' });

  await db.read();
  const exists = db.data.users.find(u => u.username === username);
  if (exists) return res.status(400).json({ error: 'username exists' });

  const hash = await bcrypt.hash(password, 10);
  const user = { id: nanoid(), username, passHash: hash, createdAt: Date.now(), online: false };
  db.data.users.push(user);
  await db.write();

  // set session
  req.session.userId = user.id;
  return res.json({ ok: true, username: user.username });
});

// login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'username & password required' });

  await db.read();
  const user = db.data.users.find(u => u.username === username);
  if(!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await bcrypt.compare(password, user.passHash);
  if(!ok) return res.status(401).json({ error: 'invalid credentials' });

  req.session.userId = user.id;
  return res.json({ ok: true, username: user.username });
});

// logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// whoami
app.get('/me', async (req, res) => {
  const uid = req.session.userId;
  if(!uid) return res.json({ logged: false });
  await db.read();
  const user = db.data.users.find(u => u.id === uid);
  if(!user) return res.json({ logged: false });
  return res.json({ logged: true, username: user.username, id: user.id });
});

/* -------------------- File upload endpoint (for media sharing) -------------------- */
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ ok: true, url, filename: req.file.filename, mimetype: req.file.mimetype });
});

/* -------------------- Fallback route to index.html -------------------- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* -------------------- Socket.io: presence, signaling, chat -------------------- */
const onlineUsers = new Map(); // socketId -> { userId, username, room }

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  // when client authenticates its session, they emit 'auth_ready' with {userId, username}
  socket.on('auth_ready', (payload) => {
    const { userId, username } = payload || {};
    if (userId) {
      onlineUsers.set(socket.id, { userId, username, room: null });
      // mark user online in db
      (async () => {
        await db.read();
        const u = db.data.users.find(x => x.id === userId);
        if(u) { u.online = true; await db.write(); }
        // broadcast updated presence list
        const pres = db.data.users.map(x => ({ id: x.id, username: x.username, online: !!x.online }));
        io.emit('presence_update', pres);
      })();
    }
  });

  socket.on('join_room', ({ roomID, username, userId }) => {
    socket.join(roomID);
    const info = onlineUsers.get(socket.id) || {};
    info.room = roomID;
    onlineUsers.set(socket.id, info);
    socket.to(roomID).emit('user_joined', { id: socket.id, username });
  });

  // text chat
  socket.on('send_message', async ({ roomID, username, message, attachment }) => {
    const payload = { id: socket.id, username, message, attachment: attachment||null, ts: Date.now() };
    io.to(roomID).emit('receive_message', payload);
    // optionally persist last messages
    await db.read();
    db.data.messages.push({ roomID, ...payload });
    if (db.data.messages.length > 1000) db.data.messages.shift();
    await db.write();
  });

  // signaling for WebRTC
  socket.on('signal', ({ roomID, target, data }) => {
    if (target) {
      socket.to(target).emit('signal', { id: socket.id, data });
    } else {
      socket.to(roomID).emit('signal', { id: socket.id, data });
    }
  });

  socket.on('disconnect', async () => {
    console.log('socket disconnect', socket.id);
    const info = onlineUsers.get(socket.id);
    if (info && info.userId) {
      // mark offline in db
      await db.read();
      const u = db.data.users.find(x => x.id === info.userId);
      if (u) { u.online = false; await db.write(); }
      onlineUsers.delete(socket.id);
      const pres = db.data.users.map(x => ({ id: x.id, username: x.username, online: !!x.online }));
      io.emit('presence_update', pres);
    }
  });
});

/* -------------------- Start server -------------------- */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
