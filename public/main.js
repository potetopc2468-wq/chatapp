const socket = io();

// UI Elements - Auth
const authScreen = document.getElementById('auth-screen');
const authTitle = document.getElementById('auth-title');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');

const loginBtn = document.getElementById('login-btn');
const loginIdInput = document.getElementById('login-id');
const loginPwInput = document.getElementById('login-pw');

const signupBtn = document.getElementById('signup-btn');
const signupIdInput = document.getElementById('signup-id');
const signupNameInput = document.getElementById('signup-name');
const signupPwInput = document.getElementById('signup-pw');

// UI Elements - App
const appContainer = document.getElementById('app');
const navItems = document.querySelectorAll('.nav-item');
const tabPanels = document.querySelectorAll('.tab-panel');
const messagesMain = document.getElementById('messages-main');
const groupList = document.getElementById('group-list');

// Group UI
const groupListHeader = document.getElementById('group-list-header');
const groupChatHeader = document.getElementById('group-chat-header');
const groupChatTitle = document.getElementById('group-chat-title');
const groupChatWindow = document.getElementById('group-chat-window');
const messagesGroup = document.getElementById('messages-group');
const groupChatForm = document.getElementById('group-chat-form');
const backToGroupListBtn = document.getElementById('back-to-group-list');

// DM UI
const privateChatList = document.getElementById('private-chat-list');
const dmWindow = document.getElementById('dm-window');
const messagesDm = document.getElementById('messages-dm');
const dmForm = document.getElementById('dm-form');
const dmTitle = document.getElementById('dm-title');
const backToDmListBtn = document.getElementById('back-to-dm-list');

// Profile
const profileIdDisplay = document.getElementById('profile-id-display');
const profileNameInput = document.getElementById('profile-name-input');
const profileBioInput = document.getElementById('profile-bio-input');
const profileAvatarPreview = document.getElementById('profile-avatar-preview');
const saveProfileBtn = document.getElementById('save-profile-btn');
const changeAvatarBtn = document.getElementById('change-avatar-btn');
const avatarUpload = document.getElementById('avatar-upload');
const logoutBtn = document.getElementById('logout-btn');

// Crop
const cropModal = document.getElementById('crop-modal');
const cropImage = document.getElementById('crop-image');
const confirmCropBtn = document.getElementById('confirm-crop');
const cancelCropBtn = document.getElementById('cancel-crop');
let cropper = null;

// Room Modal
const createRoomModal = document.getElementById('create-room-modal');
const openCreateRoomBtn = document.getElementById('open-create-room');
const closeRoomModalBtn = document.getElementById('close-modal');
const confirmCreateRoomBtn = document.getElementById('confirm-create-room');
const newRoomNameInput = document.getElementById('new-room-name');

// User Profile Modal
const userProfileModal = document.getElementById('user-profile-modal');
const closeProfileModalBtn = document.getElementById('close-profile-modal');
const startPrivateChatBtn = document.getElementById('start-private-chat');
const modalUserAvatar = document.getElementById('modal-user-avatar');
const modalUserName = document.getElementById('modal-user-name');
const modalUserBio = document.getElementById('modal-user-bio');

// Voice
const voiceParticipantsMain = document.getElementById('voice-participants-main');
const joinVoiceBtnMain = document.getElementById('join-voice-btn-main');
const micToggleBtnMain = document.getElementById('mic-toggle-btn-main');

const voiceParticipantsGroup = document.getElementById('voice-participants-group');
const joinVoiceBtnGroup = document.getElementById('join-voice-btn-group');
const micToggleBtnGroup = document.getElementById('mic-toggle-btn-group');

// State
let myUser = null;
let currentTab = 'main';
let currentRoom = 'General';
let peer = null;
let myPeerId = null;
let localStream = null;
let peers = {};
let allUsersInRoom = [];
let dmConversations = JSON.parse(localStorage.getItem('chat_dms') || '{}');
let activeDmTarget = null;
let roomMessages = { 'General': [] };

// --- Auth Logic ---
showSignup.onclick = (e) => {
  e.preventDefault();
  loginForm.style.display = 'none';
  signupForm.style.display = 'block';
  authTitle.textContent = '新規登録';
};

showLogin.onclick = (e) => {
  e.preventDefault();
  signupForm.style.display = 'none';
  loginForm.style.display = 'block';
  authTitle.textContent = 'ログイン';
};

signupBtn.onclick = () => {
  const userId = signupIdInput.value.trim();
  const username = signupNameInput.value.trim();
  const password = signupPwInput.value;
  if (!userId || !password) return alert('IDとパスワードを入力してください');
  socket.emit('signup', { userId, password, username });
};

loginBtn.onclick = () => {
  const userId = loginIdInput.value.trim();
  const password = loginPwInput.value;
  if (!userId || !password) return alert('IDとパスワードを入力してください');
  socket.emit('login', { userId, password });
};

socket.on('signupSuccess', () => {
  alert('登録完了！ログインしてください');
  showLogin.click();
});

socket.on('signupError', (msg) => alert(msg));
socket.on('loginError', (msg) => alert(msg));

socket.on('loginSuccess', (userData) => {
  myUser = userData;
  authScreen.style.display = 'none';
  appContainer.style.display = 'flex';
  updateProfileUI();
  localStorage.setItem('chat_user_id', userData.userId);
  localStorage.setItem('chat_user_pw', loginPwInput.value || signupPwInput.value);
});

// 自動ログイン
window.onload = () => {
  const savedId = localStorage.getItem('chat_user_id');
  const savedPw = localStorage.getItem('chat_user_pw');
  if (savedId && savedPw) {
    socket.emit('autoLogin', { userId: savedId, password: savedPw });
  }
};

logoutBtn.onclick = () => {
  localStorage.removeItem('chat_user_id');
  localStorage.removeItem('chat_user_pw');
  location.reload();
};

function updateProfileUI() {
  profileIdDisplay.value = myUser.userId;
  profileNameInput.value = myUser.username;
  profileBioInput.value = myUser.bio;
  profileAvatarPreview.src = myUser.avatar;
}

// --- Navigation ---
navItems.forEach(item => {
  item.onclick = () => {
    const tab = item.dataset.tab;
    switchTab(tab);
  };
});

function switchTab(tab) {
  currentTab = tab;
  navItems.forEach(i => i.classList.toggle('active', i.dataset.tab === tab));
  tabPanels.forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  if (tab === 'group') {
    socket.emit('getRooms');
    showGroupList();
  }
  if (tab === 'private') renderPrivateChatList();
}

function showGroupList() {
  groupListHeader.style.display = 'flex';
  groupChatHeader.style.display = 'none';
  groupList.style.display = 'block';
  groupChatWindow.style.display = 'none';
}

function openGroupChat(roomName) {
  currentRoom = roomName;
  groupChatTitle.textContent = roomName;
  groupListHeader.style.display = 'none';
  groupChatHeader.style.display = 'flex';
  groupList.style.display = 'none';
  groupChatWindow.style.display = 'flex';
  
  messagesGroup.innerHTML = '';
  (roomMessages[roomName] || []).forEach(msg => appendMessage(messagesGroup, msg));
  
  socket.emit('join', { roomName });
}

backToGroupListBtn.onclick = () => {
  const btn = currentTab === 'main' ? joinVoiceBtnMain : joinVoiceBtnGroup;
  const micBtn = currentTab === 'main' ? micToggleBtnMain : micToggleBtnGroup;
  stopVoice(btn, micBtn);
  
  socket.emit('join', { roomName: 'General' });
  showGroupList();
};

// --- Socket Events ---
socket.on('userList', (users) => {
  allUsersInRoom = users;
  const me = users.find(u => u.id === socket.id);
  if (me) {
    myUser = { ...myUser, ...me };
    currentRoom = me.room;
  }
  updateVoiceUI(users);
});

socket.on('roomList', (rooms) => {
  groupList.innerHTML = '';
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = 'list-item';
    const isOwner = myUser && room.ownerId === myUser.userId;
    div.innerHTML = `
      <img src="${room.ownerAvatar || 'https://api.dicebear.com/7.x/identicon/svg'}" class="list-avatar">
      <div class="list-info">
        <div class="list-name">${room.name}</div>
        <div class="list-sub">${room.count} 人が参加中 ${isOwner ? '(作成者)' : ''}</div>
      </div>
      ${isOwner ? `<button class="delete-room-btn" onclick="event.stopPropagation(); deleteRoom('${room.name}')"><i class="fas fa-trash"></i></button>` : ''}
    `;
    div.onclick = () => openGroupChat(room.name);
    groupList.appendChild(div);
  });
});

window.deleteRoom = (roomName) => {
  if (confirm(`ルーム「${roomName}」を削除しますか？`)) {
    socket.emit('deleteRoom', roomName);
  }
};

socket.on('message', (msg) => {
  const room = msg.room || 'General';
  if (!roomMessages[room]) roomMessages[room] = [];
  roomMessages[room].push(msg);

  if (room === 'General' && currentTab === 'main') {
    appendMessage(messagesMain, msg);
  } else if (room === currentRoom && currentTab === 'group') {
    appendMessage(messagesGroup, msg);
  }
});

// DM
socket.on('privateMessage', (msg) => {
  const otherId = msg.from;
  if (!dmConversations[otherId]) dmConversations[otherId] = [];
  dmConversations[otherId].push(msg);
  saveDMs();
  if (activeDmTarget === otherId) {
    appendDmMessage(msg);
  }
  if (currentTab === 'private' && !activeDmTarget) renderPrivateChatList();
});

socket.on('privateMessageSent', (msg) => {
  const otherId = msg.to;
  if (!dmConversations[otherId]) dmConversations[otherId] = [];
  dmConversations[otherId].push(msg);
  saveDMs();
  if (activeDmTarget === otherId) {
    appendDmMessage(msg);
  }
});

function saveDMs() {
  localStorage.setItem('chat_dms', JSON.stringify(dmConversations));
}

// --- UI Rendering ---
function appendMessage(container, msg) {
  const div = document.createElement('div');
  div.className = `msg-item ${msg.id === socket.id ? 'me' : ''}`;
  div.innerHTML = `
    <img src="${msg.avatar}" class="msg-avatar" onclick="showUserProfile('${msg.id}')">
    <div class="msg-content">
      <span class="msg-name">${msg.username}</span>
      <div class="msg-text">${msg.text}</div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function renderPrivateChatList() {
  privateChatList.innerHTML = '';
  privateChatList.style.display = 'block';
  dmWindow.style.display = 'none';
  backToDmListBtn.style.display = 'none';
  dmTitle.textContent = '個人チャット';

  Object.keys(dmConversations).forEach(userId => {
    const chat = dmConversations[userId];
    const lastMsg = chat[chat.length - 1];
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <img src="${lastMsg.fromAvatar}" class="list-avatar">
      <div class="list-info">
        <div class="list-name">${lastMsg.fromName || userId}</div>
        <div class="list-sub">${lastMsg.text}</div>
      </div>
    `;
    div.onclick = () => openDmWindow(userId, lastMsg.fromName);
    privateChatList.appendChild(div);
  });
}

function openDmWindow(userId, name) {
  activeDmTarget = userId;
  privateChatList.style.display = 'none';
  dmWindow.style.display = 'flex';
  backToDmListBtn.style.display = 'block';
  dmTitle.textContent = name;
  messagesDm.innerHTML = '';
  (dmConversations[userId] || []).forEach(appendDmMessage);
}

backToDmListBtn.onclick = () => {
  activeDmTarget = null;
  renderPrivateChatList();
};

function appendDmMessage(msg) {
  const div = document.createElement('div');
  div.className = `msg-item ${msg.from === socket.id ? 'me' : ''}`;
  div.innerHTML = `
    <img src="${msg.fromAvatar}" class="msg-avatar">
    <div class="msg-content">
      <span class="msg-name">${msg.fromName}</span>
      <div class="msg-text">${msg.text}</div>
    </div>
  `;
  messagesDm.appendChild(div);
  messagesDm.scrollTop = messagesDm.scrollHeight;
}

// --- Voice UI ---
function updateVoiceUI(users) {
  const participants = currentRoom === 'General' ? voiceParticipantsMain : voiceParticipantsGroup;
  if (!participants) return;
  participants.innerHTML = '';
  users.filter(u => u.isInVoice).forEach(u => {
    const img = document.createElement('img');
    img.src = u.avatar;
    img.className = `voice-avatar ${u.isSpeaking ? 'speaking' : ''} ${u.isMuted ? 'muted' : ''}`;
    participants.appendChild(img);
  });
}

// --- Voice Chat Logic ---
function handleVoiceJoin(isMain) {
  return async () => {
    const btn = isMain ? joinVoiceBtnMain : joinVoiceBtnGroup;
    const micBtn = isMain ? micToggleBtnMain : micToggleBtnGroup;
    
    if (!localStream) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        initPeer();
        btn.classList.add('active');
        micBtn.style.display = 'block';
        
        const checkPeerId = setInterval(() => {
          if (myPeerId) {
            clearInterval(checkPeerId);
            socket.emit('voiceStatus', { isInVoice: true, isMuted: true, isSpeaking: false });
          }
        }, 100);
      } catch (e) { alert('マイクを許可してください'); }
    } else {
      stopVoice(btn, micBtn);
    }
  };
}

function stopVoice(btn, micBtn) {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  btn.classList.remove('active');
  micBtn.style.display = 'none';
  socket.emit('voiceStatus', { isInVoice: false, isMuted: true, isSpeaking: false });
}

function handleMicToggle(isMain) {
  return () => {
    const micBtn = isMain ? micToggleBtnMain : micToggleBtnGroup;
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      micBtn.classList.toggle('muted', !audioTrack.enabled);
      micBtn.innerHTML = audioTrack.enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
      socket.emit('voiceStatus', { isInVoice: true, isMuted: !audioTrack.enabled, isSpeaking: false });
    }
  };
}

joinVoiceBtnMain.onclick = handleVoiceJoin(true);
micToggleBtnMain.onclick = handleMicToggle(true);
joinVoiceBtnGroup.onclick = handleVoiceJoin(false);
micToggleBtnGroup.onclick = handleMicToggle(false);

function initPeer() {
  peer = new Peer(undefined, { host: '0.peerjs.com', secure: true });
  peer.on('open', id => myPeerId = id);
  peer.on('call', call => {
    call.answer(localStream);
    const audio = document.createElement('audio');
    call.on('stream', stream => {
      audio.srcObject = stream;
      audio.play();
    });
  });
}

// --- Profile Edit & Avatar Crop ---
changeAvatarBtn.onclick = () => {
  const seed = Math.random().toString(36).substring(7);
  profileAvatarPreview.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
};

avatarUpload.onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      cropImage.src = event.target.result;
      cropModal.style.display = 'flex';
      if (cropper) cropper.destroy();
      cropper = new Cropper(cropImage, {
        aspectRatio: 1,
        viewMode: 1,
      });
    };
    reader.readAsDataURL(file);
  }
};

cancelCropBtn.onclick = () => {
  cropModal.style.display = 'none';
  if (cropper) cropper.destroy();
};

confirmCropBtn.onclick = () => {
  const canvas = cropper.getCroppedCanvas({ width: 200, height: 200 });
  profileAvatarPreview.src = canvas.toDataURL();
  cropModal.style.display = 'none';
  cropper.destroy();
};

saveProfileBtn.onclick = () => {
  const data = {
    username: profileNameInput.value.trim(),
    bio: profileBioInput.value.trim(),
    avatar: profileAvatarPreview.src
  };
  socket.emit('updateProfile', data);
  alert('プロフィールを保存しました');
};

// --- Room Creation ---
openCreateRoomBtn.onclick = () => createRoomModal.style.display = 'flex';
closeRoomModalBtn.onclick = () => createRoomModal.style.display = 'none';
confirmCreateRoomBtn.onclick = () => {
  const name = newRoomNameInput.value.trim();
  if (name) {
    socket.emit('createRoom', name);
    createRoomModal.style.display = 'none';
    openGroupChat(name);
  }
};

// --- User Profile Modal ---
function showUserProfile(userId) {
  if (userId === socket.id) return switchTab('profile');
  const user = allUsersInRoom.find(u => u.id === userId);
  if (!user) return;
  modalUserAvatar.src = user.avatar;
  modalUserName.textContent = user.username;
  modalUserBio.textContent = user.bio;
  userProfileModal.style.display = 'flex';
  
  startPrivateChatBtn.onclick = () => {
    userProfileModal.style.display = 'none';
    switchTab('private');
    openDmWindow(user.id, user.username);
  };
}
closeProfileModalBtn.onclick = () => userProfileModal.style.display = 'none';

// --- Chat Forms ---
document.getElementById('main-chat-form').onsubmit = (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const text = input.value.trim();
  if (text) {
    socket.emit('chatMessage', text);
    input.value = '';
  }
};

document.getElementById('group-chat-form').onsubmit = (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const text = input.value.trim();
  if (text) {
    socket.emit('chatMessage', text);
    input.value = '';
  }
};

dmForm.onsubmit = (e) => {
  e.preventDefault();
  const input = dmForm.querySelector('input');
  const text = input.value.trim();
  if (text && activeDmTarget) {
    socket.emit('privateMessage', { to: activeDmTarget, text });
    input.value = '';
  }
};
