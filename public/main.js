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
const mainChatForm = document.getElementById('main-chat-form');
const mainImageInput = document.getElementById('main-image-input');

// Group UI
const groupListHeader = document.getElementById('group-list-header');
const groupChatHeader = document.getElementById('group-chat-header');
const groupChatTitle = document.getElementById('group-chat-title');
const groupChatWindow = document.getElementById('group-chat-window');
const messagesGroup = document.getElementById('messages-group');
const groupChatForm = document.getElementById('group-chat-form');
const groupImageInput = document.getElementById('group-image-input');
const backToGroupListBtn = document.getElementById('back-to-group-list');

// DM UI
const privateChatList = document.getElementById('private-chat-list');
const dmWindow = document.getElementById('dm-window');
const messagesDm = document.getElementById('messages-dm');
const dmForm = document.getElementById('dm-form');
const dmImageInput = document.getElementById('dm-image-input');
const dmTitle = document.getElementById('dm-title');
const backToDmListBtn = document.getElementById('back-to-dm-list');

// Edit Message Modal
const editMessageModal = document.getElementById('edit-message-modal');
const editMessageText = document.getElementById('edit-message-text');
const editMessageImage = document.getElementById('edit-message-image');
const editMessagePreview = document.getElementById('edit-message-preview');
const saveEditMessageBtn = document.getElementById('save-edit-message');
const cancelEditMessageBtn = document.getElementById('cancel-edit-message');
const removeEditImageBtn = document.getElementById('remove-edit-image');

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
const voiceMeterMain = document.getElementById('voice-meter-main');

const voiceParticipantsGroup = document.getElementById('voice-participants-group');
const joinVoiceBtnGroup = document.getElementById('join-voice-btn-group');
const micToggleBtnGroup = document.getElementById('mic-toggle-btn-group');
const voiceMeterGroup = document.getElementById('voice-meter-group');

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
let audioContext = null;
let analyserNode = null;
let micSourceNode = null;
let speakingAnimationId = null;
let isSpeakingNow = false;
let speakingHoldUntil = 0;
const MAX_CHAT_IMAGE_BYTES = 3 * 1024 * 1024;
let editImageData = '';
let editImageRemoved = false;
let editingMessageContext = null;

const pendingImages = {
  main: '',
  group: '',
  dm: ''
};

function hashSeed(seed) {
  return String(seed).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function createPoopAvatar(seed = Math.random().toString(36).slice(2)) {
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

function getPendingKeyFromForm(form) {
  if (form === mainChatForm) return 'main';
  if (form === groupChatForm) return 'group';
  return 'dm';
}

function updateAttachButtonState(form, hasImage) {
  const btn = form.querySelector('.attach-btn');
  if (btn) btn.classList.toggle('has-image', hasImage);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('failed to read file'));
    reader.readAsDataURL(file);
  });
}

function bindImageInput(form, inputEl) {
  inputEl.addEventListener('change', async (event) => {
    const key = getPendingKeyFromForm(form);
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('画像ファイルのみ送信できます');
      inputEl.value = '';
      return;
    }
    if (file.size > MAX_CHAT_IMAGE_BYTES) {
      alert('画像サイズは3MB以下にしてください');
      inputEl.value = '';
      return;
    }

    try {
      pendingImages[key] = await fileToDataUrl(file);
      updateAttachButtonState(form, true);
    } catch (_err) {
      alert('画像の読み込みに失敗しました');
    }
  });
}

function clearPendingImage(form, inputEl) {
  const key = getPendingKeyFromForm(form);
  pendingImages[key] = '';
  inputEl.value = '';
  updateAttachButtonState(form, false);
}

function createMessagePayload(form) {
  const key = getPendingKeyFromForm(form);
  const input = form.querySelector('input[type="text"]');
  const text = input.value.trim();
  const image = pendingImages[key];
  return { text, image };
}

function getMessagePreviewText(msg) {
  if (msg.deleted) return '削除されました';
  if (msg.text) return msg.text;
  if (msg.image) return '画像を送信しました';
  return '';
}

function createMessageMeta(msg) {
  const meta = document.createElement('div');
  meta.className = 'msg-meta';

  if (msg.edited && !msg.deleted) {
    const edited = document.createElement('span');
    edited.className = 'msg-edited-badge';
    edited.textContent = '編集済み';
    meta.appendChild(edited);
  }

  return meta.childNodes.length ? meta : null;
}

function canManageMessage(msg, scope) {
  if (!msg || msg.deleted) return false;
  if (scope === 'room') return msg.id === socket.id && Boolean(msg.messageId);
  return msg.from === socket.id && Boolean(msg.messageId);
}

function openEditMessageModal(scope, msg, targetId) {
  editingMessageContext = { scope, messageId: msg.messageId, targetId, roomName: msg.room || currentRoom };
  editImageData = '';
  editImageRemoved = false;
  editMessageText.value = msg.text || '';
  editMessagePreview.src = msg.image || '';
  editMessagePreview.style.display = msg.image ? 'block' : 'none';
  editMessageImage.value = '';
  editMessageModal.style.display = 'flex';
}

function closeEditMessageModal() {
  editMessageModal.style.display = 'none';
  editingMessageContext = null;
  editImageData = '';
  editImageRemoved = false;
  editMessageImage.value = '';
}

async function handleEditImageSelection(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('画像ファイルのみ送信できます');
    editMessageImage.value = '';
    return;
  }
  if (file.size > MAX_CHAT_IMAGE_BYTES) {
    alert('画像サイズは3MB以下にしてください');
    editMessageImage.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    editImageData = String(reader.result || '');
    editImageRemoved = false;
    editMessagePreview.src = editImageData;
    editMessagePreview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function getNextEditImagePayload() {
  if (editImageRemoved) {
    return { removeImage: true, image: '' };
  }
  if (editImageData) {
    return { removeImage: false, image: editImageData };
  }
  return { removeImage: false, image: undefined };
}

function updateRoomMessage(roomName, nextMsg) {
  const list = roomMessages[roomName] || [];
  const index = list.findIndex(msg => msg.messageId === nextMsg.messageId);
  if (index !== -1) {
    list[index] = { ...list[index], ...nextMsg };
  }
}

function updateDmMessage(otherId, nextMsg) {
  const list = dmConversations[otherId] || [];
  const index = list.findIndex(msg => msg.messageId === nextMsg.messageId);
  if (index !== -1) {
    list[index] = { ...list[index], ...nextMsg };
  }
}

function renderRoomThread(roomName, container) {
  container.innerHTML = '';
  (roomMessages[roomName] || []).forEach(msg => appendMessage(container, msg));
}

function renderDmThread(otherId) {
  messagesDm.innerHTML = '';
  (dmConversations[otherId] || []).forEach(msg => appendDmMessage(msg));
}

editMessageImage.onchange = handleEditImageSelection;
removeEditImageBtn.onclick = () => {
  editImageRemoved = true;
  editImageData = '';
  editMessageImage.value = '';
  editMessagePreview.src = '';
  editMessagePreview.style.display = 'none';
};

cancelEditMessageBtn.onclick = () => {
  closeEditMessageModal();
};

saveEditMessageBtn.onclick = () => {
  if (!editingMessageContext) return;

  const text = editMessageText.value.trim();
  const imagePayload = getNextEditImagePayload();
  if (!text && !imagePayload.image && !imagePayload.removeImage) {
    alert('本文か画像を入力してください');
    return;
  }

  const basePayload = {
    messageId: editingMessageContext.messageId,
    text,
    image: imagePayload.image,
    removeImage: imagePayload.removeImage
  };

  if (editingMessageContext.scope === 'room') {
    socket.emit('editChatMessage', {
      ...basePayload,
      roomName: editingMessageContext.roomName
    });
  } else {
    socket.emit('editPrivateMessage', {
      ...basePayload,
      to: editingMessageContext.targetId
    });
  }

  closeEditMessageModal();
};

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
  if (!isAlphanumeric(userId)) return alert('ユーザーIDは英数字のみ使えます');
  if (!isAlphanumeric(password)) return alert('パスワードは英数字のみ使えます');
  socket.emit('signup', { userId, password, username });
};

loginBtn.onclick = () => {
  const userId = loginIdInput.value.trim();
  const password = loginPwInput.value;
  if (!userId || !password) return alert('IDとパスワードを入力してください');
  if (!isAlphanumeric(userId)) return alert('ユーザーIDは英数字のみ使えます');
  if (!isAlphanumeric(password)) return alert('パスワードは英数字のみ使えます');
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
  // 入力がある場合のみ（手動ログイン/新規登録時のみ）パスワードを保存
  const pw = loginPwInput.value || signupPwInput.value;
  if (pw) {
    localStorage.setItem('chat_user_pw', pw);
  }
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
  
  if (tab === 'main') {
    currentRoom = 'General';
    socket.emit('join', { roomName: 'General' });
    // ボイスチャット停止（タブを跨ぐとボイチャが混線するため、明示的に止める）
    const btn = joinVoiceBtnMain;
    const micBtn = micToggleBtnMain;
    stopVoice(btn, micBtn);
  } else if (tab === 'group') {
    socket.emit('getRooms');
    showGroupList();
    // メインのボイチャを止める
    stopVoice(joinVoiceBtnMain, micToggleBtnMain);
  } else if (tab === 'private') {
    renderPrivateChatList();
    // 全てのボイチャを止める
    stopVoice(joinVoiceBtnMain, micToggleBtnMain);
    stopVoice(joinVoiceBtnGroup, micToggleBtnGroup);
  }
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
  // 履歴はsocket.on('history')で届くので、ここではクリアするだけで良い
  // (roomMessages[roomName] || []).forEach(msg => appendMessage(messagesGroup, msg));
  
  socket.emit('join', { roomName });
}

backToGroupListBtn.onclick = () => {
  const btn = currentTab === 'main' ? joinVoiceBtnMain : joinVoiceBtnGroup;
  const micBtn = currentTab === 'main' ? micToggleBtnMain : micToggleBtnGroup;
  stopVoice(btn, micBtn);
  
  currentRoom = 'General';
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
      <img src="${room.ownerAvatar || createPoopAvatar(room.name)}" class="list-avatar">
      <div class="list-info">
        <div class="list-name">${room.name}</div>
        <div class="list-sub">${room.count} 人が参加中 ・ ${room.messageCount || 0} 件のコメント ${isOwner ? '(作成者)' : ''}</div>
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

socket.on('history', (history) => {
  const room = history.length > 0 ? history[0].room : currentRoom;
  roomMessages[room] = history;
  
  if (room === 'General' && currentTab === 'main') {
    renderRoomThread(room, messagesMain);
  } else if (room === currentRoom && currentTab === 'group') {
    renderRoomThread(room, messagesGroup);
  }
});

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

socket.on('messageUpdated', (msg) => {
  const room = msg.room || 'General';
  updateRoomMessage(room, msg);
  if (room === 'General' && currentTab === 'main') {
    renderRoomThread(room, messagesMain);
  } else if (room === currentRoom && currentTab === 'group') {
    renderRoomThread(room, messagesGroup);
  }
});

socket.on('messageDeleted', (msg) => {
  const room = msg.room || 'General';
  updateRoomMessage(room, msg);
  if (room === 'General' && currentTab === 'main') {
    renderRoomThread(room, messagesMain);
  } else if (room === currentRoom && currentTab === 'group') {
    renderRoomThread(room, messagesGroup);
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

socket.on('privateMessageUpdated', (msg) => {
  const otherId = msg.from === socket.id ? msg.to : msg.from;
  updateDmMessage(otherId, msg);
  if (activeDmTarget === otherId) {
    renderDmThread(otherId);
  }
  if (currentTab === 'private' && !activeDmTarget) renderPrivateChatList();
});

socket.on('privateMessageDeleted', (msg) => {
  const otherId = msg.from === socket.id ? msg.to : msg.from;
  updateDmMessage(otherId, msg);
  if (activeDmTarget === otherId) {
    renderDmThread(otherId);
  }
  if (currentTab === 'private' && !activeDmTarget) renderPrivateChatList();
});

function saveDMs() {
  localStorage.setItem('chat_dms', JSON.stringify(dmConversations));
}

// --- UI Rendering ---
function appendMessage(container, msg) {
  const div = document.createElement('div');
  div.className = `msg-item ${msg.id === socket.id ? 'me' : ''}`;

  const avatar = document.createElement('img');
  avatar.src = msg.avatar;
  avatar.className = 'msg-avatar';
  avatar.addEventListener('click', () => showUserProfile(msg.id));

  const content = document.createElement('div');
  content.className = 'msg-content';

  const name = document.createElement('span');
  name.className = 'msg-name';
  name.textContent = msg.username;

  content.appendChild(name);

  if (msg.deleted) {
    const deleted = document.createElement('div');
    deleted.className = 'msg-text deleted';
    deleted.textContent = '削除されました';
    content.appendChild(deleted);
  } else {
    if (msg.text) {
      const text = document.createElement('div');
      text.className = 'msg-text';
      text.textContent = msg.text;
      content.appendChild(text);
    }

    if (msg.image) {
      const image = document.createElement('img');
      image.src = msg.image;
      image.className = 'msg-image';
      image.alt = 'chat image';
      image.addEventListener('click', () => window.open(msg.image, '_blank', 'noopener,noreferrer'));
      content.appendChild(image);
    }

    const meta = createMessageMeta(msg);
    if (meta) content.appendChild(meta);
  }

  if (canManageMessage(msg, 'room')) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'msg-action-btn';
    editBtn.textContent = '編集';
    editBtn.onclick = () => openEditMessageModal('room', msg);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'msg-action-btn';
    deleteBtn.textContent = '削除';
    deleteBtn.onclick = () => socket.emit('deleteChatMessage', { roomName: msg.room || 'General', messageId: msg.messageId });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    content.appendChild(actions);
  }

  div.appendChild(avatar);
  div.appendChild(content);
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
    if (!chat.length) return;
    const lastMsg = chat[chat.length - 1];
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <img src="${lastMsg.fromAvatar}" class="list-avatar">
      <div class="list-info">
        <div class="list-name">${lastMsg.fromName || userId}</div>
        <div class="list-sub">${getMessagePreviewText(lastMsg)}</div>
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
  renderDmThread(userId);
}

backToDmListBtn.onclick = () => {
  activeDmTarget = null;
  renderPrivateChatList();
};

function appendDmMessage(msg) {
  const div = document.createElement('div');
  div.className = `msg-item ${msg.from === socket.id ? 'me' : ''}`;

  const avatar = document.createElement('img');
  avatar.src = msg.fromAvatar;
  avatar.className = 'msg-avatar';

  const content = document.createElement('div');
  content.className = 'msg-content';

  const name = document.createElement('span');
  name.className = 'msg-name';
  name.textContent = msg.fromName;
  content.appendChild(name);

  if (msg.deleted) {
    const deleted = document.createElement('div');
    deleted.className = 'msg-text deleted';
    deleted.textContent = '削除されました';
    content.appendChild(deleted);
  } else {
    if (msg.text) {
      const text = document.createElement('div');
      text.className = 'msg-text';
      text.textContent = msg.text;
      content.appendChild(text);
    }

    if (msg.image) {
      const image = document.createElement('img');
      image.src = msg.image;
      image.className = 'msg-image';
      image.alt = 'dm image';
      image.addEventListener('click', () => window.open(msg.image, '_blank', 'noopener,noreferrer'));
      content.appendChild(image);
    }

    const meta = createMessageMeta(msg);
    if (meta) content.appendChild(meta);
  }

  if (canManageMessage(msg, 'dm')) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'msg-action-btn';
    editBtn.textContent = '編集';
    editBtn.onclick = () => openEditMessageModal('dm', msg, msg.from === socket.id ? msg.to : msg.from);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'msg-action-btn';
    deleteBtn.textContent = '削除';
    deleteBtn.onclick = () => socket.emit('deletePrivateMessage', { to: msg.from === socket.id ? msg.to : msg.from, messageId: msg.messageId });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    content.appendChild(actions);
  }

  div.appendChild(avatar);
  div.appendChild(content);
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

function updateVoiceMeters(level = 0, isMuted = true, isInVoice = false) {
  [voiceMeterMain, voiceMeterGroup].forEach((meter) => {
    if (!meter) return;
    const fill = meter.querySelector('.voice-meter-fill');
    if (!fill) return;

    const normalizedLevel = Math.max(0, Math.min(1, level));
    fill.style.transform = `scaleX(${isInVoice && !isMuted ? normalizedLevel : 0.02})`;
    meter.classList.toggle('active', isInVoice && !isMuted && normalizedLevel > 0.05);
    meter.classList.toggle('muted', !isInVoice || isMuted);
  });
}

function emitVoiceStatus(isMuted) {
  const nextMuted = Boolean(isMuted);
  if (nextMuted) {
    isSpeakingNow = false;
  }
  updateVoiceMeters(0, nextMuted, Boolean(localStream));
  socket.emit('voiceStatus', {
    isInVoice: Boolean(localStream),
    isMuted: nextMuted,
    isSpeaking: isSpeakingNow && !nextMuted
  });
}

function stopSpeakingDetection() {
  if (speakingAnimationId) {
    cancelAnimationFrame(speakingAnimationId);
    speakingAnimationId = null;
  }
  if (micSourceNode) {
    micSourceNode.disconnect();
    micSourceNode = null;
  }
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  isSpeakingNow = false;
  speakingHoldUntil = 0;
  updateVoiceMeters(0, true, false);
}

function startSpeakingDetection() {
  stopSpeakingDetection();
  if (!localStream) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  audioContext = new AudioContextClass();
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 512;
  micSourceNode = audioContext.createMediaStreamSource(localStream);
  micSourceNode.connect(analyserNode);

  const samples = new Uint8Array(analyserNode.fftSize);

  const detect = () => {
    if (!analyserNode || !localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    const isMuted = !audioTrack || !audioTrack.enabled;

    analyserNode.getByteTimeDomainData(samples);
    let squareSum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const normalized = (samples[i] - 128) / 128;
      squareSum += normalized * normalized;
    }

    const volume = Math.sqrt(squareSum / samples.length);
    const meterLevel = Math.min(1, volume * 12);
    updateVoiceMeters(meterLevel, isMuted, true);
    if (!isMuted && volume > 0.055) {
      speakingHoldUntil = Date.now() + 220;
    }

    const nextSpeaking = !isMuted && Date.now() < speakingHoldUntil;
    if (nextSpeaking !== isSpeakingNow) {
      isSpeakingNow = nextSpeaking;
      emitVoiceStatus(isMuted);
    }

    speakingAnimationId = requestAnimationFrame(detect);
  };

  detect();
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
        startSpeakingDetection();
        btn.classList.add('active');
        micBtn.style.display = 'block';
        micBtn.classList.add('muted');
        micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        
        const checkPeerId = setInterval(() => {
          if (myPeerId) {
            clearInterval(checkPeerId);
            emitVoiceStatus(true);
          }
        }, 100);
      } catch (e) { alert('マイクを許可してください'); }
    } else {
      stopVoice(btn, micBtn);
    }
  };
}

function stopVoice(btn, micBtn) {
  stopSpeakingDetection();
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  btn.classList.remove('active');
  micBtn.style.display = 'none';
  micBtn.classList.add('muted');
  micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
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
      if (!audioTrack.enabled) {
        isSpeakingNow = false;
      }
      emitVoiceStatus(!audioTrack.enabled);
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
  profileAvatarPreview.src = createPoopAvatar();
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
mainChatForm.onsubmit = (e) => {
  e.preventDefault();
  const payload = createMessagePayload(mainChatForm);
  if (!payload.text && !payload.image) return;
  socket.emit('chatMessage', payload);
  mainChatForm.querySelector('input[type="text"]').value = '';
  clearPendingImage(mainChatForm, mainImageInput);
};

groupChatForm.onsubmit = (e) => {
  e.preventDefault();
  const payload = createMessagePayload(groupChatForm);
  if (!payload.text && !payload.image) return;
  socket.emit('chatMessage', payload);
  groupChatForm.querySelector('input[type="text"]').value = '';
  clearPendingImage(groupChatForm, groupImageInput);
};

dmForm.onsubmit = (e) => {
  e.preventDefault();
  const payload = createMessagePayload(dmForm);
  if ((!payload.text && !payload.image) || !activeDmTarget) return;
  socket.emit('privateMessage', { to: activeDmTarget, text: payload.text, image: payload.image });
  dmForm.querySelector('input[type="text"]').value = '';
  clearPendingImage(dmForm, dmImageInput);
};

bindImageInput(mainChatForm, mainImageInput);
bindImageInput(groupChatForm, groupImageInput);
bindImageInput(dmForm, dmImageInput);
