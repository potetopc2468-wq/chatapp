const socket = io();

const joinScreen = document.getElementById('join-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');
const messages = document.getElementById('messages');
const onlineCount = document.getElementById('online-count');
const usersList = document.getElementById('users-list');
const ttsToggle = document.getElementById('tts-toggle');
const micBtn = document.getElementById('mic-btn');

let myId = null;
let username = '';
let isTtsEnabled = false;
let myPeerId = null;
let peer = null;
let localStream = null;
const peers = {};

// PeerJSの初期化
function initPeer() {
  peer = new Peer(undefined, {
    host: '/',
    port: '443',
    secure: true
  });

  peer.on('open', (id) => {
    myPeerId = id;
    console.log('My peer ID is: ' + id);
  });

  peer.on('call', (call) => {
    if (localStream) {
      call.answer(localStream);
      const audio = document.createElement('audio');
      call.on('stream', (userAudioStream) => {
        addAudioStream(audio, userAudioStream);
      });
    }
  });
}

function addAudioStream(audio, stream) {
  audio.srcObject = stream;
  audio.addEventListener('loadedmetadata', () => {
    audio.play();
  });
}

// マイクの取得
async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // 初期状態はミュート
    localStream.getAudioTracks()[0].enabled = false;
    micBtn.classList.remove('muted');
    micBtn.classList.add('active');
    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
  } catch (err) {
    console.error('Failed to get local stream', err);
    alert('マイクが取得できませんでした。ボイスチャットは利用できません。');
  }
}

// マイクボタンのクリック
micBtn.addEventListener('click', () => {
  if (!localStream) return;
  
  const enabled = localStream.getAudioTracks()[0].enabled;
  if (enabled) {
    localStream.getAudioTracks()[0].enabled = false;
    micBtn.classList.remove('active');
    micBtn.classList.add('muted');
    micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
  } else {
    localStream.getAudioTracks()[0].enabled = true;
    micBtn.classList.remove('muted');
    micBtn.classList.add('active');
    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
  }
});

// 読み上げ設定の切り替え
ttsToggle.addEventListener('change', (e) => {
  isTtsEnabled = e.target.checked;
  if (isTtsEnabled) {
    const utter = new SpeechSynthesisUtterance('読み上げモードをオンにしました');
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);
  }
});

// 参加ボタンのクリック
joinBtn.addEventListener('click', async () => {
  username = usernameInput.value.trim();
  if (username) {
    await getMedia();
    initPeer();
    
    // Peer IDが取得できるまで少し待つ
    const checkPeerId = setInterval(() => {
      if (myPeerId) {
        clearInterval(checkPeerId);
        socket.emit('join', { username, peerId: myPeerId });
        joinScreen.style.display = 'none';
        msgInput.focus();
      }
    }, 100);
  } else {
    alert('名前を入力してください');
  }
});

// メッセージ送信
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = msgInput.value.trim();
  if (msg) {
    socket.emit('chatMessage', msg);
    msgInput.value = '';
    msgInput.focus();
  }
});

// メッセージ受信
socket.on('message', (msg) => {
  displayMessage(msg);
  messages.scrollTop = messages.scrollHeight;

  if (isTtsEnabled && msg.type === 'user') {
    const textToSpeak = `${msg.username}さんから、${msg.text}`;
    const utter = new SpeechSynthesisUtterance(textToSpeak);
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);
  } else if (isTtsEnabled && msg.type === 'system') {
    const utter = new SpeechSynthesisUtterance(msg.text);
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);
  }
});

// ユーザーリスト更新 & ボイス接続
socket.on('userList', (users) => {
  onlineCount.textContent = users.length;
  usersList.innerHTML = '';
  
  users.forEach(user => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="fas fa-circle" style="color: #2ecc71; font-size: 8px; margin-right: 10px;"></i> ${user.username}`;
    usersList.appendChild(li);

    // 自分以外かつ、まだ接続していないユーザーに電話をかける
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
  });

  peers[userId] = call;
}

socket.on('connect', () => {
  myId = socket.id;
});

function displayMessage(msg) {
  const div = document.createElement('div');
  div.classList.add('message');
  
  if (msg.type === 'system') {
    div.classList.add('system');
    div.innerHTML = `<span class="text">${msg.text}</span>`;
  } else {
    if (msg.id === myId) {
      div.classList.add('me');
    }
    div.innerHTML = `
      <span class="username">${msg.username} <span style="font-weight: normal; font-size: 10px; color: #95a5a6;">${msg.timestamp}</span></span>
      <span class="text">${msg.text}</span>
    `;
  }
  
  messages.appendChild(div);
}
