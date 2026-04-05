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

let myId = null;
let username = '';
let isTtsEnabled = false;

// 読み上げ設定の切り替え
ttsToggle.addEventListener('change', (e) => {
  isTtsEnabled = e.target.checked;
  if (isTtsEnabled) {
    // 最初の音声を再生するためのユーザーインタラクションのヒント（ブラウザ制限対策）
    const utter = new SpeechSynthesisUtterance('読み上げモードをオンにしました');
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);
  }
});

// 参加ボタンのクリック
joinBtn.addEventListener('click', () => {
  username = usernameInput.value.trim();
  if (username) {
    socket.emit('join', username);
    joinScreen.style.display = 'none';
    msgInput.focus();
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

  // 読み上げモードが有効で、ユーザーメッセージの場合のみ読み上げる
  if (isTtsEnabled && msg.type === 'user') {
    const textToSpeak = `${msg.username}さんから、${msg.text}`;
    const utter = new SpeechSynthesisUtterance(textToSpeak);
    utter.lang = 'ja-JP';
    utter.rate = 1.0;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } else if (isTtsEnabled && msg.type === 'system') {
    const utter = new SpeechSynthesisUtterance(msg.text);
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);
  }
});

// ユーザーリスト更新
socket.on('userList', (users) => {
  onlineCount.textContent = users.length;
  usersList.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="fas fa-circle" style="color: #2ecc71; font-size: 8px; margin-right: 10px;"></i> ${user.username}`;
    usersList.appendChild(li);
  });
});

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
