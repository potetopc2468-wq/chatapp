const socket = io();

// UI Elements
const navItems = document.querySelectorAll('.nav-item');
const tabPanels = document.querySelectorAll('.tab-panel');
const groupList = document.getElementById('group-list');
const privateChatList = document.getElementById('private-chat-list');
const profileAvatarPreview = document.getElementById('profile-avatar-preview');
const profileNameInput = document.getElementById('profile-name-input');
const profileBioInput = document.getElementById('profile-bio-input');
const saveProfileBtn = document.getElementById('save-profile-btn');
const changeAvatarBtn = document.getElementById('change-avatar-btn');

const createRoomModal = document.getElementById('create-room-modal');
const openCreateRoomBtn = document.getElementById('open-create-room');
const closeRoomModalBtn = document.getElementById('close-modal');
const confirmCreateRoomBtn = document.getElementById('confirm-create-room');
const newRoomNameInput = document.getElementById('new-room-name');

const userProfileModal = document.getElementById('user-profile-modal');
const closeProfileModalBtn = document.getElementById('close-profile-modal');
const startPrivateChatBtn = document.getElementById('start-private-chat');
const modalUserAvatar = document.getElementById('modal-user-avatar');
const modalUserName = document.getElementById('modal-user-name');
const modalUserBio = document.getElementById('modal-user-bio');

const voiceParticipants = document.getElementById('voice-participants');
const joinVoiceBtn = document.getElementById('join-voice-btn');
const micToggleBtn = document.getElementById('mic-toggle-btn');

// State
let myUser = null;
let currentTab = 'main';
let peer = null;
let myPeerId = null;
let localStream = null;
let peers = {};
let allUsersInRoom = [];
let selectedUserForProfile = null;

// --- Tab Navigation ---
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tab = item.dataset.tab;
    switchTab(tab);
  });
});

function switchTab(tab) {
  currentTab = tab;
  navItems.forEach(i => i.classList.toggle('active', i.dataset.tab === tab));
  tabPanels.forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  
  if (tab === 'group') socket.emit('getRooms');
  if (tab === 'profile' && myUser) {
    profileAvatarPreview.src = myUser.avatar;
    profileNameInput.value = myUser.username;
    profileBioInput.value = myUser.bio;
  }
}

// --- Socket Events ---
socket.on('connect', () => {
  console.log('Connected as:', socket.id);
  // 初期ルーム参加
  socket.emit('join', { roomName: 'General' });
});

socket.on('userList', (users) => {
  allUsersInRoom = users;
  const me = users.find(u => u.id === socket.id);
  if (me) myUser = me;
  updateVoiceUI(users);
});

socket.on('roomList', (rooms) => {
  renderGroupList(rooms);
});

socket.on('message', (msg) => {
  const area = document.getElementById('messages-main');
  appendMessage(area, msg);
});

socket.on('privateMessage', (msg) => {
  // 簡易的にプライベートチャットリストを更新
  renderPrivateChatList(msg);
});

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

function renderGroupList(rooms) {
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
      if (confirm(`${room.name} に参加しますか？`)) {
        socket.emit('join', { roomName: room.name });
        switchTab('main');
        document.getElementById('messages-main').innerHTML = ''; // 簡易クリア
      }
    };
    groupList.appendChild(div);
  });
}

function updateVoiceUI(users) {
  voiceParticipants.innerHTML = '';
  users.filter(u => u.isInVoice).forEach(u => {
    const img = document.createElement('img');
    img.src = u.avatar;
    img.className = `voice-avatar ${u.isSpeaking ? 'speaking' : ''} ${u.isMuted ? 'muted' : ''}`;
    voiceParticipants.appendChild(img);
  });
}

// --- Profile & DM ---
function showUserProfile(userId) {
  const user = allUsersInRoom.find(u => u.id === userId);
  if (!user) return;
  selectedUserForProfile = user;
  modalUserAvatar.src = user.avatar;
  modalUserName.textContent = user.username;
  modalUserBio.textContent = user.bio;
  userProfileModal.style.display = 'flex';
}

closeProfileModalBtn.onclick = () => userProfileModal.style.display = 'none';

startPrivateChatBtn.onclick = () => {
  userProfileModal.style.display = 'none';
  switchTab('private');
  // 実際にはここでDM画面に切り替えるなどの処理
};

saveProfileBtn.onclick = () => {
  const data = {
    username: profileNameInput.value,
    bio: profileBioInput.value,
    avatar: profileAvatarPreview.src
  };
  socket.emit('updateProfile', data);
  alert('プロフィールを保存しました');
};

changeAvatarBtn.onclick = () => {
  const newSeed = Math.random().toString(36).substring(7);
  const newAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${newSeed}`;
  profileAvatarPreview.src = newAvatar;
};

// --- Room Modal ---
openCreateRoomBtn.onclick = () => createRoomModal.style.display = 'flex';
closeRoomModalBtn.onclick = () => createRoomModal.style.display = 'none';
confirmCreateRoomBtn.onclick = () => {
  const name = newRoomNameInput.value.trim();
  if (name) {
    socket.emit('join', { roomName: name });
    createRoomModal.style.display = 'none';
    switchTab('main');
    document.getElementById('messages-main').innerHTML = '';
  }
};

// --- Voice Logic ---
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
    } catch (e) {
      alert('マイクの使用を許可してください');
    }
  } else {
    // 退出
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
document.querySelectorAll('.chat-input-form').forEach(form => {
  form.onsubmit = (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (text) {
      socket.emit('chatMessage', text);
      input.value = '';
    }
  };
});
