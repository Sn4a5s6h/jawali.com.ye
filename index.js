const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // يسمح بالاتصال من أي نطاق
});

// تمكين CORS
app.use(cors());

// ملفات ثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// عند الوصول إلى "/"، إرسال index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket / Socket.io
io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // الانضمام إلى غرفة
  socket.on('join_room', (roomID) => {
    socket.join(roomID);
    socket.to(roomID).emit('user_joined', socket.id);
    console.log(`${socket.id} joined room ${roomID}`);
  });

  // إرسال واستقبال إشارات WebRTC
  socket.on('signal', ({ roomID, target, data }) => {
    if(target) {
      socket.to(target).emit('signal', { id: socket.id, data });
    } else {
      socket.to(roomID).emit('signal', { id: socket.id, data });
    }
  });

  // عند قطع الاتصال
  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

// تشغيل الخادم على المنفذ المحدد
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
