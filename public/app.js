// client app.js
const socket = io();

// DOM
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnRegister = document.getElementById('btnRegister');
const btnLogin = document.getElementById('btnLogin');
const authMsg = document.getElementById('authMsg');

const controls = document.getElementById('controls');
const startBtn = document.getElementById('startBtn');
const leaveBtn = document.getElementById('leaveBtn');
const roomInput = document.getElementById('roomInput');
const linkP = document.getElementById('link');

const usersList = document.getElementById('usersList');
const meArea = document.getElementById('meArea');

const localVideoDiv = document.getElementById('localVideoDiv');
const remoteVideoDiv = document.getElementById('remoteVideoDiv');
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendMsg = document.getElementById('sendMsg');
const fileInput = document.getElementById('fileInput');

let localStream = null;
let peers = {};
let currentRoom = null;
let me = { logged:false, username:null, id:null };

// helper
function el(tag,txt){ const e=document.createElement(tag); if(txt)e.textContent=txt; return e; }
function appendMsgHTML(html){ const d=document.createElement('div'); d.className='msg'; d.innerHTML = html; messagesDiv.appendChild(d); messagesDiv.scrollTop = messagesDiv.scrollHeight; }

// ===== Authentication =====
async function whoami(){
  const r = await fetch('/me'); const j = await r.json();
  if(j.logged){ me.logged = true; me.username=j.username; me.id=j.id; meArea.innerHTML = `<strong>${me.username}</strong> <button id="btnLogout" class="btn secondary">Logout</button>`; document.getElementById('btnLogout').onclick = logout; controls.style.display='block'; document.getElementById('authSection').style.display='none'; socket.emit('auth_ready', { userId: me.id, username: me.username }); }
}
async function logout(){
  await fetch('/logout',{method:'POST'}); location.reload();
}

btnRegister.onclick = async () => {
  const username = usernameInput.value.trim(), password = passwordInput.value;
  if(!username||!password){ authMsg.textContent='Enter username & password'; return; }
  const res = await fetch('/register',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password})});
  const j = await res.json();
  if(!j.ok) authMsg.textContent = j.error || 'Register failed';
  else { authMsg.style.color='green'; authMsg.textContent='Registered — logged in.'; await whoami(); }
};

btnLogin.onclick = async () => {
  const username = usernameInput.value.trim(), password = passwordInput.value;
  if(!username||!password){ authMsg.textContent='Enter username & password'; return; }
  const res = await fetch('/login',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password})});
  const j = await res.json();
  if(!j.ok){ authMsg.style.color='tomato'; authMsg.textContent=j.error||'Login failed'; return; }
  await whoami();
};

// On load, check session
whoami();

// ===== Presence updates =====
socket.on('presence_update', (list) => {
  usersList.innerHTML = '';
  list.forEach(u => {
    const row = document.createElement('div');
    const left = document.createElement('div');
    const dot = document.createElement('span');
    dot.className = 'presence-dot ' + (u.online ? 'presence-online':'presence-offline');
    left.appendChild(dot);
    left.appendChild(document.createTextNode(' ' + u.username));
    row.appendChild(left);
    // allow DM or invite to room by clicking
    const btn = document.createElement('button');
    btn.textContent = 'Invite';
    btn.className = 'btn secondary';
    btn.onclick = ()=> {
      const rid = currentRoom || Math.random().toString(36).slice(2,10);
      roomInput.value = rid; linkP.textContent = `Room Link: ${window.location.origin}?room=${rid}`;
      alert(`Share this link with ${u.username}: ${window.location.origin}?room=${rid}`);
    };
    row.appendChild(btn);
    usersList.appendChild(row);
  });
});

// ===== Media (getUserMedia) =====
async function getMedia(){
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    localVideoDiv.innerHTML = '';
    const v = document.createElement('video');
    v.srcObject = localStream; v.autoplay=true; v.muted=true; v.playsInline=true;
    localVideoDiv.appendChild(v);
  } catch(e){ alert('Allow camera/microphone: '+e.message); }
}

// ===== WebRTC peer creation =====
function createPeer(socketID, roomID){
  const pc = new RTCPeerConnection();
  if(localStream) localStream.getTracks().forEach(t=>pc.addTrack(t, localStream));
  pc.ontrack = (ev)=> {
    remoteVideoDiv.innerHTML=''; const rv=document.createElement('video'); rv.srcObject=ev.streams[0]; rv.autoplay=true; rv.playsInline=true; remoteVideoDiv.appendChild(rv);
  };
  pc.onicecandidate = (ev)=> { if(ev.candidate){ socket.emit('signal', { roomID, target: socketID, data: { candidate: ev.candidate } }); } };
  return pc;
}

// start / join
startBtn.onclick = async ()=> {
  let rid = roomInput.value.trim();
  if(!rid){ rid = Math.random().toString(36).slice(2,10); roomInput.value = rid; }
  currentRoom = rid;
  linkP.textContent = `Room Link: ${window.location.origin}?room=${rid}`;
  await getMedia();
  socket.emit('join_room', { roomID: rid, username: me.username, userId: me.id });
  startBtn.style.display='none';
  leaveBtn.style.display='inline-block';
};

// optional leave
leaveBtn.onclick = ()=> { location.reload(); };

// signaling handlers
socket.on('user_joined', ({ id, username })=>{
  // when another user joins our room, create peer and send offer
  if(!currentRoom) return;
  const pc = createPeer(id, currentRoom);
  peers[id] = pc;
  pc.createOffer().then(offer=> pc.setLocalDescription(offer).then(()=> {
    socket.emit('signal', { roomID: currentRoom, target: id, data: { sdp: offer } });
  }));
  appendMsgHTML(`<i>${username||'User'} joined the room</i>`);
});

socket.on('signal', async ({ id, data })=>{
  if(!peers[id]) peers[id] = createPeer(id, currentRoom);
  const pc = peers[id];
  if(data.sdp){
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if(data.sdp.type==='offer'){
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      socket.emit('signal', { roomID: currentRoom, target: id, data: { sdp: ans } });
    }
  } else if(data.candidate){
    try{ await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); }
    catch(e){ console.error(e); }
  }
});

// ===== Text chat & file upload =====
sendMsg.onclick = sendMessage;
msgInput.addEventListener('keydown', (e)=> { if(e.key==='Enter') sendMessage(); });

async function sendMessage(){
  const text = msgInput.value.trim();
  if(!text && !fileInput.files.length) return;
  let attach = null;
  if(fileInput.files.length){
    const f = fileInput.files[0];
    const fd = new FormData();
    fd.append('file', f);
    const r = await fetch('/upload', { method:'POST', body: fd });
    const j = await r.json();
    if(j.ok) attach = j.url;
  }
  const payload = { roomID: currentRoom, username: me.username, message: text || '', attachment: attach };
  socket.emit('send_message', payload);
  appendLocalMessage(me.username, text, attach);
  msgInput.value = ''; fileInput.value = '';
}

function appendLocalMessage(user, text, attach){
  let html = `<strong>${user}</strong>: ${escapeHtml(text)}`;
  if(attach) {
    const ext = attach.split('.').pop().toLowerCase();
    if(['png','jpg','jpeg','gif','webp'].includes(ext)) html += `<div><img src="${attach}" style="max-width:320px;border-radius:8px;margin-top:6px"></div>`;
    else html += `<div><a href="${attach}" target="_blank">Download file</a></div>`;
  }
  appendMsgHTML(html);
}

socket.on('receive_message', (p)=>{
  appendMsgHTML(`<strong>${escapeHtml(p.username)}</strong>: ${escapeHtml(p.message)}` + (p.attachment?`<div><a href="${p.attachment}" target="_blank">File</a></div>`:''));
});

// ===== small helpers =====
function appendMsgHTML(html){ const d=document.createElement('div'); d.className='msg'; d.innerHTML = html; messagesDiv.appendChild(d); messagesDiv.scrollTop = messagesDiv.scrollHeight; }
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

// read ?room param to prefill
window.addEventListener('load', ()=> {
  const params = new URLSearchParams(location.search);
  const r = params.get('room');
  if(r) roomInput.value = r;
});
