const socket = io();

const lobbyScreen = document.getElementById('lobby-screen');
const chatContainer = document.querySelector('.chat-container');
const usernameInput = document.getElementById('username-input');
const newRoomInput = document.getElementById('new-room-input');
const createBtn = document.getElementById('create-btn');
const roomListUl = document.getElementById('room-list');
const currentRoomName = document.getElementById('current-room-name');
const backToLobbyBtn = document.getElementById('back-to-lobby');

const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');
const messages = document.getElementById('messages');
const onlineCount = document.getElementById('online-count');
const usersList = document.getElementById('users-list');
const ttsToggle = document.getElementById('tts-toggle');
const micBtn = document.getElementById('mic-btn');

let myId = null;
let username = '';
let currentRoom = '';
let isTtsEnabled = false;
let myPeerId = null;
let peer = null;
let localStream = null;
let peers = {};

// --- ロビー機能 ---

// ルーム一覧の受信
socket.on('roomList', (rooms) => {
  roomListUl.innerHTML = '';
  if (rooms.length === 0) {
    roomListUl.innerHTML = '<li class="no-rooms">公開ルームがありません。「General」がデフォルトです。</li>';
    // デフォルトルームを表示
    addRoomItem('General', 0);
  } else {
    rooms.forEach(room => {
      addRoomItem(room.name, room.count);
    });
    // Generalがなければ追加
    if (!rooms.find(r => r.name === 'General')) {
      addRoomItem('General', 0);
    }
  }
});

function addRoomItem(name, count) {
  const li = document.createElement('li');
  li.innerHTML = `
    <span class="room-name">${name}</span>
    <span class="room-count">${count} 人</span>
  `;
  li.onclick = () => joinRoom(name);
  roomListUl.appendChild(li);
}

// ルーム作成
createBtn.onclick = () => {
  const roomName = newRoomInput.value.trim();
  if (roomName) {
    joinRoom(roomName);
  } else {
    alert('ルーム名を入力してください');
  }
};

// ロビーに戻る
backToLobbyBtn.onclick = () => {
  if (confirm('ルームを退出してロビーに戻りますか？')) {
    location.reload(); // シンプルにリロードして状態をリセット
  }
};

// ページ読み込み時にルーム一覧を要求
socket.emit('getRooms');

// --- チャット & ボイス機能 ---

async function joinRoom(roomName) {
  username = usernameInput.value.trim();
  if (!username) {
    alert('ニックネームを入力してください');
    return;
  }

  currentRoom = roomName;
  currentRoomName.innerHTML = `<i class="fas fa-comments"></i> ${roomName}`;
  
  lobbyScreen.style.display = 'none';
  chatContainer.style.display = 'flex';

  await getMedia();
  initPeer();
  
  // Peer ID取得後にJoin
  const checkPeerId = setInterval(() => {
    if (myPeerId) {
      clearInterval(checkPeerId);
      socket.emit('join', { username, peerId: myPeerId, roomName: currentRoom });
      msgInput.focus();
    }
  }, 100);
}

// PeerJSの初期化
function initPeer() {
  peer = new Peer(undefined, {
    host: '0.peerjs.com', // 公開サーバーを明示的に使用
    secure: true
  });

  peer.on('open', (id) => {
    myPeerId = id;
    console.log('My peer ID is: ' + id);
  });

  peer.on('call', (call) => {
    console.log('Receiving call from:', call.peer);
    call.answer(localStream);
    const audio = document.createElement('audio');
    call.on('stream', (userAudioStream) => {
      addAudioStream(audio, userAudioStream);
    });
  });

  peer.on('error', (err) => {
    console.error('PeerJS Error:', err);
  });
}

function addAudioStream(audio, stream) {
  audio.srcObject = stream;
  audio.addEventListener('loadedmetadata', () => {
    audio.play();
  });
}

async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getAudioTracks()[0].enabled = false; // 初期はミュート
    micBtn.classList.remove('active');
    micBtn.classList.add('muted');
  } catch (err) {
    console.error('Failed to get local stream', err);
    // マイクがなくてもチャットは続けられるようにする
    localStream = null;
  }
}

micBtn.addEventListener('click', () => {
  if (!localStream) {
    alert('マイクの使用が許可されていないか、デバイスが見つかりません');
    return;
  }
  
  const enabled = localStream.getAudioTracks()[0].enabled;
  if (enabled) {
    localStream.getAudioTracks()[0].enabled = false;
    micBtn.classList.replace('active', 'muted');
    micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
  } else {
    localStream.getAudioTracks()[0].enabled = true;
    micBtn.classList.replace('muted', 'active');
    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
  }
});

ttsToggle.addEventListener('change', (e) => {
  isTtsEnabled = e.target.checked;
  if (isTtsEnabled) {
    const utter = new SpeechSynthesisUtterance('読み上げモードをオンにしました');
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);
  }
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = msgInput.value.trim();
  if (msg) {
    socket.emit('chatMessage', msg);
    msgInput.value = '';
  }
});

socket.on('message', (msg) => {
  displayMessage(msg);
  messages.scrollTop = messages.scrollHeight;

  if (isTtsEnabled) {
    const text = msg.type === 'system' ? msg.text : `${msg.username}さんから、${msg.text}`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);
  }
});

socket.on('userList', (users) => {
  onlineCount.textContent = users.length;
  usersList.innerHTML = '';
  
  users.forEach(user => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="fas fa-circle" style="color: #2ecc71; font-size: 8px; margin-right: 10px;"></i> ${user.username}`;
    usersList.appendChild(li);

    if (user.id !== socket.id && user.peerId && !peers[user.id]) {
      connectToNewUser(user.id, user.peerId);
    }
  });
});

function connectToNewUser(userId, peerId) {
  if (!localStream) return;
  
  console.log(`Calling user ${userId} at peer ${peerId}`);
  const call = peer.call(peerId, localStream);
  const audio = document.createElement('audio');
  
  call.on('stream', (userAudioStream) => {
    addAudioStream(audio, userAudioStream);
  });
  
  call.on('close', () => {
    audio.remove();
    delete peers[userId];
  });

  peers[userId] = call;
}

socket.on('connect', () => {
  myId = socket.id;
});

function displayMessage(msg) {
  const div = document.createElement('div');
  div.classList.add('message');
  if (msg.type === 'system') div.classList.add('system');
  if (msg.id === myId) div.classList.add('me');

  div.innerHTML = msg.type === 'system' 
    ? `<span class="text">${msg.text}</span>`
    : `<span class="username">${msg.username} <span style="font-weight:normal; font-size:9px; color:#999;">${msg.timestamp}</span></span>
       <span class="text">${msg.text}</span>`;
  
  messages.appendChild(div);
}
