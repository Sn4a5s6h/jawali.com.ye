const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.static('/'));

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join_room', (roomID) => {
    socket.join(roomID);
    socket.to(roomID).emit('user_joined', socket.id);
  });

  socket.on('signal', ({ roomID, target, data }) => {
    if(target) {
      socket.to(target).emit('signal', { id: socket.id, data });
    } else {
      socket.to(roomID).emit('signal', { id: socket.id, data });
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
