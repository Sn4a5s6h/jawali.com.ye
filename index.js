// index.js (CommonJS)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// serve public files
app.use(express.static(path.join(__dirname, 'public')));

// maps to track broadcaster socket per room
const broadcasters = new Map(); // roomID -> socket.id

io.on('connection', socket => {
  console.log('Socket connected:', socket.id);

  // Broadcaster says "I'm the broadcaster for ROOM"
  socket.on('broadcaster', (roomID) => {
    console.log('broadcaster for room', roomID, 'is', socket.id);
    broadcasters.set(roomID, socket.id);
    // notify watchers if needed
    socket.join(roomID);
    io.to(roomID).emit('broadcaster-available', { roomID });
  });

  // Watcher joins a room and asks to watch
  socket.on('watcher', (roomID) => {
    const bId = broadcasters.get(roomID);
    if (bId) {
      console.log('watcher', socket.id, 'wants to watch room', roomID, 'broadcaster', bId);
      // tell broadcaster that a watcher joined (pass watcher id)
      io.to(bId).emit('watcher', { watcherId: socket.id });
    } else {
      // no broadcaster yet — inform watcher
      socket.emit('no-broadcaster', { roomID });
    }
  });

  // Broadcaster sends offer (SDP) to a specific watcher
  socket.on('offer', ({ watcherId, sdp }) => {
    console.log('offer from broadcaster', socket.id, 'to watcher', watcherId);
    io.to(watcherId).emit('offer', { from: socket.id, sdp });
  });

  // Watcher sends answer (SDP) back to broadcaster
  socket.on('answer', ({ broadcasterId, sdp }) => {
    console.log('answer from watcher', socket.id, 'to broadcaster', broadcasterId);
    io.to(broadcasterId).emit('answer', { from: socket.id, sdp });
  });

  // ICE candidates in either direction
  socket.on('candidate', ({ targetId, candidate }) => {
    if (targetId) {
      io.to(targetId).emit('candidate', { from: socket.id, candidate });
    }
  });

  // If broadcaster disconnects, remove mapping and notify watchers
  socket.on('disconnect', () => {
    console.log('Socket disconnected', socket.id);
    // find any rooms the socket was broadcaster of
    for (const [roomID, bId] of broadcasters.entries()) {
      if (bId === socket.id) {
        broadcasters.delete(roomID);
        // notify all in room that broadcaster left
        io.to(roomID).emit('broadcaster-left', { roomID });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 
