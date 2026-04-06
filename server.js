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
  maxHttpBufferSize: 1e7
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));
app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

// 永続化用ユーザーデータ
let registeredUsers = {};
if (fs.existsSync(USERS_FILE)) {
  try {
    registeredUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) { console.error('Failed to load users'); }
}

// 永続化用ルームデータ
let persistentRooms = {}; // { roomName: { ownerId, ownerAvatar } }
if (fs.existsSync(ROOMS_FILE)) {
  try {
    persistentRooms = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8'));
  } catch (e) { console.error('Failed to load rooms'); }
}

function saveData() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(registeredUsers, null, 2));
  fs.writeFileSync(ROOMS_FILE, JSON.stringify(persistentRooms, null, 2));
}

function hashSeed(seed) {
  return String(seed).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function createPoopAvatar(seed) {
  const hue = hashSeed(seed) % 360;
  const fill = `hsl(${hue}, 70%, 55%)`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="32" fill="#fff7ed"/>
      <path d="M64 18c9 0 16 7 16 16 0 2 0 4-1 6 16 5 27 18 27 34 0 20-19 36-42 36S22 94 22 74c0-16 11-29 27-34-1-2-1-4-1-6 0-9 7-16 16-16Z" fill="${fill}" stroke="#5b341c" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="50" cy="66" r="6" fill="#1f2937"/>
      <circle cx="78" cy="66" r="6" fill="#1f2937"/>
      <path d="M50 86c8 6 20 6 28 0" fill="none" stroke="#1f2937" stroke-width="6" stroke-linecap="round"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function isAlphanumeric(value) {
  return /^[A-Za-z0-9]+$/.test(value);
}

const activeSessions = new Map(); // socket.id -> userData
const roomUsers = new Map(); // roomName -> Set of socketIds
const roomHistory = new Map(); // roomName -> Array of messages

function addHistory(roomName, msg) {
  if (!roomHistory.has(roomName)) roomHistory.set(roomName, []);
  const history = roomHistory.get(roomName);
  history.push(msg);
  if (history.length > 50) history.shift();
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 自動ログイン試行用
  socket.on('autoLogin', async (data) => {
    const { userId, password } = data;
    const user = registeredUsers[userId];
    if (user && await bcrypt.compare(password, user.password)) {
      loginUser(socket, user);
    }
  });

  socket.on('signup', async (data) => {
    const { userId, password, username } = data;
    if (!isAlphanumeric(userId)) {
      return socket.emit('signupError', 'ユーザーIDは英数字のみ使えます');
    }
    if (!isAlphanumeric(password)) {
      return socket.emit('signupError', 'パスワードは英数字のみ使えます');
    }
    if (registeredUsers[userId]) return socket.emit('signupError', 'このユーザーIDは既に使用されています');
    const hashedPassword = await bcrypt.hash(password, 10);
    registeredUsers[userId] = {
      userId,
      password: hashedPassword,
      username: username || userId,
      avatar: createPoopAvatar(userId),
      bio: 'よろしくお願いします！'
    };
    saveData();
    socket.emit('signupSuccess');
  });

  socket.on('login', async (data) => {
    const { userId, password } = data;
    if (!isAlphanumeric(userId) || !isAlphanumeric(password)) {
      return socket.emit('loginError', 'ユーザーIDとパスワードは英数字のみ使えます');
    }
    const user = registeredUsers[userId];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return socket.emit('loginError', 'IDまたはパスワードが正しくありません');
    }
    loginUser(socket, user);
  });

  function loginUser(socket, user) {
    const userData = { 
      ...user, 
      id: socket.id, 
      room: 'General', 
      isInVoice: false, 
      isMuted: true, 
      isSpeaking: false 
    };
    delete userData.password;
    activeSessions.set(socket.id, userData);
    socket.emit('loginSuccess', userData);
    joinRoom(socket, 'General');
  }

  socket.on('getRooms', () => {
    sendRoomList(socket);
  });

  socket.on('createRoom', (roomName) => {
    const user = activeSessions.get(socket.id);
    if (!user) return;
    if (roomName === 'General') return;
    
    if (!persistentRooms[roomName]) {
      persistentRooms[roomName] = {
        ownerId: user.userId,
        ownerAvatar: user.avatar
      };
      saveData();
    }
    joinRoom(socket, roomName);
    sendRoomList(); // 全員に通知
  });

  socket.on('deleteRoom', (roomName) => {
    const user = activeSessions.get(socket.id);
    if (!user) return;
    if (persistentRooms[roomName] && persistentRooms[roomName].ownerId === user.userId) {
      delete persistentRooms[roomName];
      saveData();
      // ルームにいる人をGeneralに飛ばす
      if (roomUsers.has(roomName)) {
        const ids = Array.from(roomUsers.get(roomName));
        ids.forEach(id => {
          const s = io.sockets.sockets.get(id);
          if (s) joinRoom(s, 'General');
        });
      }
      sendRoomList();
    }
  });

  socket.on('join', (data) => {
    joinRoom(socket, data.roomName || 'General');
  });

  function joinRoom(socket, roomName) {
    const user = activeSessions.get(socket.id);
    if (!user) return;

    const oldRoom = user.room;
    socket.leave(oldRoom);
    if (roomUsers.has(oldRoom)) {
      roomUsers.get(oldRoom).delete(socket.id);
      if (roomUsers.get(oldRoom).size === 0 && oldRoom !== 'General' && !persistentRooms[oldRoom]) {
        roomUsers.delete(oldRoom);
      } else {
        updateRoomUserList(oldRoom);
      }
    }

    user.room = roomName;
    user.isInVoice = false;
    socket.join(roomName);

    if (!roomUsers.has(roomName)) roomUsers.set(roomName, new Set());
    roomUsers.get(roomName).add(socket.id);

    updateRoomUserList(roomName);
    sendRoomList();

    // 履歴を送る
    if (roomHistory.has(roomName)) {
      socket.emit('history', roomHistory.get(roomName));
    } else {
      socket.emit('history', []);
    }
  }

  function updateRoomUserList(roomName) {
    if (!roomUsers.has(roomName)) return;
    const users = Array.from(roomUsers.get(roomName)).map(id => activeSessions.get(id)).filter(Boolean);
    io.to(roomName).emit('userList', users);
  }

  function sendRoomList(target = io) {
    const list = Object.keys(persistentRooms).map(name => ({
      name,
      ownerId: persistentRooms[name].ownerId,
      ownerAvatar: persistentRooms[name].ownerAvatar,
      count: roomUsers.has(name) ? roomUsers.get(name).size : 0
    }));
    target.emit('roomList', list);
  }

  socket.on('chatMessage', (msg) => {
    const user = activeSessions.get(socket.id);
    if (user) {
      const chatMsg = {
        type: 'user',
        username: user.username,
        avatar: user.avatar,
        text: msg,
        timestamp: new Date().toLocaleTimeString(),
        id: socket.id,
        room: user.room
      };
      addHistory(user.room, chatMsg);
      io.to(user.room).emit('message', chatMsg);
    }
  });

  socket.on('voiceStatus', (data) => {
    const user = activeSessions.get(socket.id);
    if (user) {
      user.isInVoice = data.isInVoice;
      user.isMuted = data.isMuted;
      user.isSpeaking = data.isSpeaking;
      updateRoomUserList(user.room);
    }
  });

  socket.on('updateProfile', (data) => {
    const session = activeSessions.get(socket.id);
    if (session) {
      const user = registeredUsers[session.userId];
      if (user) {
        user.username = data.username || user.username;
        user.avatar = data.avatar || user.avatar;
        user.bio = data.bio || user.bio;
        saveData();
        session.username = user.username;
        session.avatar = user.avatar;
        session.bio = user.bio;
        updateRoomUserList(session.room);
      }
    }
  });

  socket.on('disconnect', () => {
    const user = activeSessions.get(socket.id);
    if (user) {
      const room = user.room;
      if (roomUsers.has(room)) {
        roomUsers.get(room).delete(socket.id);
        updateRoomUserList(room);
      }
      activeSessions.delete(socket.id);
      sendRoomList();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
