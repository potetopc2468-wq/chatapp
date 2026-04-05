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

// socket.id -> userData
const allUsers = new Map();
// roomName -> Set of userDatas
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 初期ユーザー登録 (デフォルト)
  const defaultUser = {
    id: socket.id,
    username: `User_${socket.id.substr(0, 4)}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${socket.id}`,
    bio: 'よろしくお願いします！',
    peerId: null,
    room: 'General',
    isMuted: true,
    isSpeaking: false,
    isInVoice: false
  };
  allUsers.set(socket.id, defaultUser);

  // ルーム一覧の取得
  socket.on('getRooms', () => {
    const roomList = Array.from(rooms.keys())
      .filter(name => name !== 'General')
      .map(name => {
        const roomSet = rooms.get(name);
        const owner = Array.from(roomSet)[0]; // 最初のユーザーをオーナーとする
        return {
          name,
          count: roomSet.size,
          ownerAvatar: owner ? owner.avatar : null
        };
      });
    socket.emit('roomList', roomList);
  });

  // プロフィール更新
  socket.on('updateProfile', (data) => {
    const user = allUsers.get(socket.id);
    if (user) {
      user.username = data.username || user.username;
      user.avatar = data.avatar || user.avatar;
      user.bio = data.bio || user.bio;
      
      // 全ルームに反映
      io.emit('userUpdated', user);
      
      // ルーム内のユーザーリストも更新
      if (rooms.has(user.room)) {
        io.to(user.room).emit('userList', Array.from(rooms.get(user.room)));
      }
    }
  });

  // ルーム入室
  socket.on('join', (data) => {
    const { roomName, peerId } = data;
    const user = allUsers.get(socket.id);
    if (!user) return;

    const oldRoom = user.room;
    socket.leave(oldRoom);
    if (rooms.has(oldRoom)) {
      const oldRoomSet = rooms.get(oldRoom);
      oldRoomSet.forEach(u => {
        if (u.id === socket.id) oldRoomSet.delete(u);
      });
      if (oldRoomSet.size === 0 && oldRoom !== 'General') rooms.delete(oldRoom);
      else io.to(oldRoom).emit('userList', Array.from(oldRoomSet));
    }

    user.room = roomName || 'General';
    user.peerId = peerId || user.peerId;
    socket.join(user.room);

    if (!rooms.has(user.room)) rooms.set(user.room, new Set());
    rooms.get(user.room).add(user);

    io.to(user.room).emit('userList', Array.from(rooms.get(user.room)));
    updateGlobalRoomList();
  });

  // ボイスステータス更新
  socket.on('voiceStatus', (data) => {
    const user = allUsers.get(socket.id);
    if (user) {
      user.isInVoice = data.isInVoice;
      user.isMuted = data.isMuted;
      user.isSpeaking = data.isSpeaking;
      io.to(user.room).emit('userList', Array.from(rooms.get(user.room)));
    }
  });

  // チャットメッセージ
  socket.on('chatMessage', (msg) => {
    const user = allUsers.get(socket.id);
    if (user) {
      io.to(user.room).emit('message', {
        type: 'user',
        username: user.username,
        avatar: user.avatar,
        text: msg,
        timestamp: new Date().toLocaleTimeString(),
        id: socket.id
      });
    }
  });

  // 個人チャット (DM)
  socket.on('privateMessage', (data) => {
    const { to, text } = data;
    const fromUser = allUsers.get(socket.id);
    const toUser = allUsers.get(to);
    if (fromUser && toUser) {
      const msg = {
        from: socket.id,
        fromName: fromUser.username,
        fromAvatar: fromUser.avatar,
        text,
        timestamp: new Date().toLocaleTimeString()
      };
      io.to(to).emit('privateMessage', msg);
      socket.emit('privateMessageSent', { ...msg, to });
    }
  });

  socket.on('disconnect', () => {
    const user = allUsers.get(socket.id);
    if (user) {
      if (rooms.has(user.room)) {
        const roomSet = rooms.get(user.room);
        roomSet.forEach(u => {
          if (u.id === socket.id) roomSet.delete(u);
        });
        if (roomSet.size === 0 && user.room !== 'General') rooms.delete(user.room);
        else io.to(user.room).emit('userList', Array.from(roomSet));
      }
      allUsers.delete(socket.id);
      updateGlobalRoomList();
    }
  });

  function updateGlobalRoomList() {
    const roomList = Array.from(rooms.keys())
      .filter(name => name !== 'General')
      .map(name => {
        const roomSet = rooms.get(name);
        const owner = Array.from(roomSet)[0];
        return { name, count: roomSet.size, ownerAvatar: owner ? owner.avatar : null };
      });
    io.emit('roomList', roomList);
  }
});

server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
