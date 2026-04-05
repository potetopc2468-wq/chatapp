import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e7 // 10MB (for avatar uploads)
});

const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.static(path.join(__dirname, 'public')));

// 永続化用ユーザーデータ (userId -> data)
let registeredUsers = {};
if (fs.existsSync(USERS_FILE)) {
  try {
    registeredUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to load users file');
  }
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(registeredUsers, null, 2));
}

// 接続中のセッション情報 (socket.id -> userData)
const activeSessions = new Map();
// roomName -> Set of userDatas
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 新規登録
  socket.on('signup', async (data) => {
    const { userId, password, username } = data;
    if (registeredUsers[userId]) {
      return socket.emit('signupError', 'このユーザーIDは既に使用されています');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    registeredUsers[userId] = {
      userId,
      password: hashedPassword,
      username: username || userId,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
      bio: 'よろしくお願いします！'
    };
    saveUsers();
    socket.emit('signupSuccess');
  });

  // ログイン
  socket.on('login', async (data) => {
    const { userId, password } = data;
    const user = registeredUsers[userId];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return socket.emit('loginError', 'IDまたはパスワードが正しくありません');
    }
    
    // セッション開始
    const userData = { ...user, id: socket.id, room: 'General', isInVoice: false, isMuted: true, isSpeaking: false };
    delete userData.password; // パスワードは送らない
    activeSessions.set(socket.id, userData);
    
    socket.emit('loginSuccess', userData);
    
    // 自動でGeneralに参加
    joinRoom(socket, 'General');
  });

  // ルーム一覧取得
  socket.on('getRooms', () => {
    updateGlobalRoomList(socket);
  });

  // プロフィール更新
  socket.on('updateProfile', (data) => {
    const session = activeSessions.get(socket.id);
    if (session) {
      const user = registeredUsers[session.userId];
      if (user) {
        user.username = data.username || user.username;
        user.avatar = data.avatar || user.avatar;
        user.bio = data.bio || user.bio;
        saveUsers();
        
        // セッション情報も更新
        session.username = user.username;
        session.avatar = user.avatar;
        session.bio = user.bio;
        
        io.emit('userUpdated', session);
        if (rooms.has(session.room)) {
          io.to(session.room).emit('userList', Array.from(rooms.get(session.room)));
        }
      }
    }
  });

  // ルーム入室
  socket.on('join', (data) => {
    const { roomName } = data;
    joinRoom(socket, roomName || 'General');
  });

  // ボイスステータス更新
  socket.on('voiceStatus', (data) => {
    const user = activeSessions.get(socket.id);
    if (user) {
      user.isInVoice = data.isInVoice;
      user.isMuted = data.isMuted;
      user.isSpeaking = data.isSpeaking;
      if (rooms.has(user.room)) {
        io.to(user.room).emit('userList', Array.from(rooms.get(user.room)));
      }
    }
  });

  // メッセージ
  socket.on('chatMessage', (msg) => {
    const user = activeSessions.get(socket.id);
    if (user) {
      io.to(user.room).emit('message', {
        type: 'user',
        username: user.username,
        avatar: user.avatar,
        text: msg,
        timestamp: new Date().toLocaleTimeString(),
        id: socket.id,
        room: user.room
      });
    }
  });

  socket.on('disconnect', () => {
    const user = activeSessions.get(socket.id);
    if (user) {
      const room = user.room;
      if (rooms.has(room)) {
        const roomSet = rooms.get(room);
        roomSet.forEach(u => { if (u.id === socket.id) roomSet.delete(u); });
        if (roomSet.size === 0 && room !== 'General') rooms.delete(room);
        else io.to(room).emit('userList', Array.from(roomSet));
      }
      activeSessions.delete(socket.id);
      updateGlobalRoomList();
    }
  });

  function joinRoom(socket, roomName) {
    const user = activeSessions.get(socket.id);
    if (!user) return;

    const oldRoom = user.room;
    socket.leave(oldRoom);
    if (rooms.has(oldRoom)) {
      const oldRoomSet = rooms.get(oldRoom);
      oldRoomSet.forEach(u => { if (u.id === socket.id) oldRoomSet.delete(u); });
      if (oldRoomSet.size === 0 && oldRoom !== 'General') rooms.delete(oldRoom);
      else io.to(oldRoom).emit('userList', Array.from(oldRoomSet));
    }

    user.room = roomName;
    user.isInVoice = false;
    socket.join(roomName);

    if (!rooms.has(roomName)) rooms.set(roomName, new Set());
    rooms.get(roomName).add(user);

    io.to(roomName).emit('userList', Array.from(rooms.get(roomName)));
    updateGlobalRoomList();
  }

  function updateGlobalRoomList(target = io) {
    const roomList = Array.from(rooms.keys())
      .filter(name => name !== 'General')
      .map(name => {
        const roomSet = rooms.get(name);
        const owner = Array.from(roomSet)[0];
        return { name, count: roomSet.size, ownerAvatar: owner ? owner.avatar : null };
      });
    target.emit('roomList', roomList);
  }
});

server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
