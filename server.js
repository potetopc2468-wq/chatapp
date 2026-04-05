import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// 接続中のユーザー情報を保持 (socket.id -> userData)
const allUsers = new Map();
// ルームごとの情報を保持 (roomName -> Set of userDatas)
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // ルーム一覧の取得
  socket.on('getRooms', () => {
    const roomList = Array.from(rooms.keys()).map(name => ({
      name,
      count: rooms.get(name).size
    }));
    socket.emit('roomList', roomList);
  });

  // ユーザーの入室 (ルーム機能対応)
  socket.on('join', (data) => {
    const { username, peerId, roomName } = data;
    const room = roomName || 'General';
    
    // 前のルームがあれば退出 (念のため)
    socket.leaveAll();
    socket.join(room);

    const userData = { 
      id: socket.id, 
      username: username || `Guest_${socket.id.substr(0, 4)}`,
      peerId: peerId,
      room: room
    };
    
    allUsers.set(socket.id, userData);
    
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    rooms.get(room).add(userData);
    
    // そのルームの全員にシステムメッセージを送信
    io.to(room).emit('message', {
      type: 'system',
      text: `${userData.username}がルーム「${room}」に入室しました`,
      timestamp: new Date().toLocaleTimeString()
    });

    // そのルームのユーザーリストを更新
    const roomUsers = Array.from(rooms.get(room));
    io.to(room).emit('userList', roomUsers);

    // 全体にルームリストの更新を通知
    updateGlobalRoomList();
  });

  // メッセージの受信と転送
  socket.on('chatMessage', (msg) => {
    const user = allUsers.get(socket.id);
    if (user) {
      io.to(user.room).emit('message', {
        type: 'user',
        username: user.username,
        text: msg,
        timestamp: new Date().toLocaleTimeString(),
        id: socket.id
      });
    }
  });

  // 切断時
  socket.on('disconnect', () => {
    const user = allUsers.get(socket.id);
    if (user) {
      const room = user.room;
      io.to(room).emit('message', {
        type: 'system',
        text: `${user.username}が退室しました`,
        timestamp: new Date().toLocaleTimeString()
      });
      
      allUsers.delete(socket.id);
      if (rooms.has(room)) {
        const roomSet = rooms.get(room);
        roomSet.forEach(u => {
          if (u.id === socket.id) roomSet.delete(u);
        });
        
        if (roomSet.size === 0) {
          rooms.delete(room);
        } else {
          io.to(room).emit('userList', Array.from(roomSet));
        }
      }
      updateGlobalRoomList();
    }
    console.log('User disconnected:', socket.id);
  });

  function updateGlobalRoomList() {
    const roomList = Array.from(rooms.keys()).map(name => ({
      name,
      count: rooms.get(name).size
    }));
    io.emit('roomList', roomList);
  }
});

server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
