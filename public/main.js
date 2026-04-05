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
const chatTitle = document.getElementById('chat-title');
const backToLobbyBtn = document.getElementById('back-to-lobby');
const messagesMain = document.getElementById('messages-main');
const groupList = document.getElementById('group-list');
const privateChatList = document.getElementById('private-chat-list');

// Profile
const profileIdDisplay = document.getElementById('profile-id-display');
const profileNameInput = document.getElementById('profile-name-input');
const profileBioInput = document.getElementById('profile-bio-input');
const profileAvatarPreview = document.getElementById('profile-avatar-preview');
const saveProfileBtn = document.getElementById('save-profile-btn');
const changeAvatarBtn = document.getElementById('change-avatar-btn');
const avatarUpload = document.getElementById('avatar-upload');

// Crop
const cropModal = document.getElementById('crop-modal');
const cropImage = document.getElementById('crop-image');
const confirmCropBtn = document.getElementById('confirm-crop');
const cancelCropBtn = document.getElementById('cancel-crop');
let cropper = null;

// Room
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
const voiceParticipants = document.getElementById('voice-participants');
const joinVoiceBtn = document.getElementById('join-voice-btn');
const micToggleBtn = document.getElementById('mic-toggle-btn');

// State
let myUser = null;
let currentTab = 'main';
let currentRoom = 'General';
let peer = null;
let myPeerId = null;
let localStream = null;
let peers = {};
let allUsersInRoom = [];

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
  const data = {
    userId: signupIdInput.value.trim(),
    username: signupNameInput.value.trim(),
    password: signupPwInput.value
  };
  if (!data.userId || !data.password) return alert('IDとパスワードを入力してください');
  socket.emit('signup', data);
};

loginBtn.onclick = () => {
  const data = {
    userId: loginIdInput.value.trim(),
    password: loginPwInput.value
  };
  if (!data.userId || !data.password) return alert('IDとパスワードを入力してください');
  socket.emit('login', data);
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
});

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
  if (tab === 'group') socket.emit('getRooms');
}

backToLobbyBtn.onclick = () => {
  socket.emit('join', { roomName: 'General' });
};

// --- Socket Events ---
socket.on('userList', (users) => {
  allUsersInRoom = users;
  const me = users.find(u => u.id === socket.id);
  if (me) {
    myUser = { ...myUser, ...me };
    if (me.room !== 'General') {
      chatTitle.textContent = me.room;
      backToLobbyBtn.style.display = 'block';
    } else {
      chatTitle.textContent = 'メインチャット';
      backToLobbyBtn.style.display = 'none';
    }
  }
  updateVoiceUI(users);
});

socket.on('roomList', (rooms) => {
  groupList.innerHTML = '';
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <img src="${room.ownerAvatar || 'https://api.dicebear.com/7.x/identicon/svg'}" class="list-avatar">
      <div class="list-info">
        <div class="list-name">${room.name}</div>
        <div class="list-sub">${room.count} 人が参加中</div>
      </div>
    `;
    div.onclick = () => {
      socket.emit('join', { roomName: room.name });
      switchTab('main');
      messagesMain.innerHTML = '';
    };
    groupList.appendChild(div);
  });
});

socket.on('message', (msg) => {
  const div = document.createElement('div');
  div.className = `msg-item ${msg.id === socket.id ? 'me' : ''}`;
  div.innerHTML = `
    <img src="${msg.avatar}" class="msg-avatar" onclick="showUserProfile('${msg.id}')">
    <div class="msg-content">
      <span class="msg-name">${msg.username}</span>
      <div class="msg-text">${msg.text}</div>
    </div>
  `;
  messagesMain.appendChild(div);
  messagesMain.scrollTop = messagesMain.scrollHeight;
});

// --- Voice UI ---
function updateVoiceUI(users) {
  voiceParticipants.innerHTML = '';
  users.filter(u => u.isInVoice).forEach(u => {
    const img = document.createElement('img');
    img.src = u.avatar;
    img.className = `voice-avatar ${u.isSpeaking ? 'speaking' : ''} ${u.isMuted ? 'muted' : ''}`;
    voiceParticipants.appendChild(img);
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
    socket.emit('join', { roomName: name });
    createRoomModal.style.display = 'none';
    switchTab('main');
    messagesMain.innerHTML = '';
  }
};

// --- User Profile Modal ---
function showUserProfile(userId) {
  const user = allUsersInRoom.find(u => u.id === userId);
  if (!user) return;
  modalUserAvatar.src = user.avatar;
  modalUserName.textContent = user.username;
  modalUserBio.textContent = user.bio;
  userProfileModal.style.display = 'flex';
}
closeProfileModalBtn.onclick = () => userProfileModal.style.display = 'none';

// --- Voice Chat Logic ---
joinVoiceBtn.onclick = async () => {
  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      initPeer();
      joinVoiceBtn.classList.add('active');
      micToggleBtn.style.display = 'block';
      
      const checkPeerId = setInterval(() => {
        if (myPeerId) {
          clearInterval(checkPeerId);
          socket.emit('voiceStatus', { isInVoice: true, isMuted: true, isSpeaking: false });
        }
      }, 100);
    } catch (e) { alert('マイクを許可してください'); }
  } else {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
    joinVoiceBtn.classList.remove('active');
    micToggleBtn.style.display = 'none';
    socket.emit('voiceStatus', { isInVoice: false, isMuted: true, isSpeaking: false });
  }
};

micToggleBtn.onclick = () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    micToggleBtn.classList.toggle('muted', !audioTrack.enabled);
    micToggleBtn.innerHTML = audioTrack.enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
    socket.emit('voiceStatus', { isInVoice: true, isMuted: !audioTrack.enabled, isSpeaking: false });
  }
};

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

// --- Chat Form ---
document.querySelector('.chat-input-form').onsubmit = (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const text = input.value.trim();
  if (text) {
    socket.emit('chatMessage', text);
    input.value = '';
  }
};
