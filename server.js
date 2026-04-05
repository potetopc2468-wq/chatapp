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

// 接続中のユーザー情報を保持
const users = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // ユーザーの入室
  socket.on('join', (username) => {
    const user = { id: socket.id, username: username || `Guest_${socket.id.substr(0, 4)}` };
    users.set(socket.id, user);
    
    // 全員にシステムメッセージを送信
    io.emit('message', {
      type: 'system',
      text: `${user.username}が入室しました`,
      timestamp: new Date().toLocaleTimeString()
    });

    // ユーザーリストを更新
    io.emit('userList', Array.from(users.values()));
  });

  // メッセージの受信と転送
  socket.on('chatMessage', (msg) => {
    const user = users.get(socket.id);
    if (user) {
      io.emit('message', {
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
    const user = users.get(socket.id);
    if (user) {
      io.emit('message', {
        type: 'system',
        text: `${user.username}が退室しました`,
        timestamp: new Date().toLocaleTimeString()
      });
      users.delete(socket.id);
      io.emit('userList', Array.from(users.values()));
    }
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
