import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ملفات HTML
app.use(express.static("public"));

let broadcasterId = null;

io.on("connection", socket => {
  console.log("🔗 Connected:", socket.id);

  // تسجيل المذيع
  socket.on("broadcaster", () => {
    broadcasterId = socket.id;
    console.log("🎙 Broadcaster:", broadcasterId);
  });

  // مشاهد ينضم
  socket.on("watcher", () => {
    if (broadcasterId) {
      io.to(broadcasterId).emit("watcher", {
        watcherId: socket.id
      });
    } else {
      socket.emit("no-broadcaster");
    }
  });

  // WebRTC offer
  socket.on("offer", ({ watcherId, sdp }) => {
    io.to(watcherId).emit("offer", {
      from: socket.id,
      sdp
    });
  });

  // WebRTC answer
  socket.on("answer", ({ targetId, sdp }) => {
    io.to(targetId).emit("answer", {
      from: socket.id,
      sdp
    });
  });

  // ICE candidate
  socket.on("candidate", ({ targetId, candidate }) => {
    io.to(targetId).emit("candidate", {
      from: socket.id,
      candidate
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    if (socket.id === broadcasterId) {
      broadcasterId = null;
      io.emit("no-broadcaster");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
