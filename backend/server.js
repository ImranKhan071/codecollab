// const express = require("express");
import express from "express";
const app = express();
// const http = require("http");
import http from "http";
// const path = require("path");
import path from "path";
// const { Server } = require("socket.io");
import { Server } from "socket.io";

// const ACTIONS = require("../frontend/src/actions/Actions");
import ACTIONS from "../frontend/src/actions/Actions.js";

const server = http.createServer(app);
const io = new Server(server);

const __dirname = path.resolve();

// app.use(express.static(__dirname, "dist"));

// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "dist", "index.html"));
// });

app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

// app.use((req, res, next) => {
//     res.sendFile(path.join(__dirname, 'build', 'index.html'));
// })

const userSocketMap = {};

function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
}

io.on("connection", (socket) => {
  console.log("Socket Connected", socket.id);

  // for joining room
  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);

    if (Array.isArray(clients)) {
      clients.forEach(({ socketId }) => {
        io.to(socketId).emit(ACTIONS.JOINED, {
          clients,
          username,
          socketId: socket.id,
        });
      });
    } else {
      console.log("Clients data is not an array:", clients);
    }
  });

  // for sync
  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  // disconnecting from socket
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
    socket.leave();
  });

  socket.on(ACTIONS.LEAVE_ROOM, ({ roomId, username }) => {
    const leavingSocketId = Object.keys(userSocketMap).find(
      (key) => userSocketMap[key] === username
    );

    if (leavingSocketId) {
      // Emit a custom event to notify other clients that the user left
      socket.to(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: leavingSocketId,
        username: userSocketMap[leavingSocketId],
      });

      // Remove the user from the userSocketMap
      delete userSocketMap[leavingSocketId];
    }
  });
});

// port listen
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
