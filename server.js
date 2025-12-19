import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let broadcaster = null;

io.on("connection", socket => {

  socket.on("broadcaster", () => {
    broadcaster = socket.id;
  });

  socket.on("watcher", () => {
    if (broadcaster) {
      io.to(broadcaster).emit("watcher", { watcherId: socket.id });
    } else {
      socket.emit("no-broadcaster");
    }
  });

  socket.on("offer", data => {
    io.to(data.watcherId).emit("offer", {
      from: socket.id,
      sdp: data.sdp
    });
  });

  socket.on("answer", data => {
    io.to(data.targetId).emit("answer", {
      from: socket.id,
      sdp: data.sdp
    });
  });

  socket.on("candidate", data => {
    io.to(data.targetId).emit("candidate", {
      from: socket.id,
      candidate: data.candidate
    });
  });

  socket.on("disconnect", () => {
    if (socket.id === broadcaster) {
      broadcaster = null;
      io.emit("no-broadcaster");
    }
  });
});

server.listen(process.env.PORT || 3000);
