const socket = io();
let localStream;
let peers = {};

const videosDiv = document.getElementById('videos');
const createBtn = document.getElementById('createRoom');
const joinBtn = document.getElementById('joinRoom');
const roomInput = document.getElementById('roomInput');
const linkP = document.getElementById('link');

// الحصول على الكاميرا والميكروفون
async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const localVideo = document.createElement('video');
    localVideo.srcObject = localStream;
    localVideo.autoplay = true;
    localVideo.muted = true; // كتم الصوت المحلي لتجنب الصدى
    videosDiv.appendChild(localVideo);
  } catch (err) {
    alert('Error accessing camera or microphone: ' + err.message);
  }
}

// إنشاء اتصال WebRTC جديد
function createPeer(socketID, roomID) {
  const peer = new RTCPeerConnection();

  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  peer.ontrack = (event) => {
    // عرض الفيديو القادم
    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.autoplay = true;
    videosDiv.appendChild(remoteVideo);
  };

  peer.onicecandidate = (event) => {
    if(event.candidate) {
      socket.emit('signal', { roomID, target: socketID, data: { candidate: event.candidate } });
    }
  };

  return peer;
}

// إنشاء غرفة جديدة
createBtn.onclick = async () => {
  const roomID = Math.random().toString(36).substring(2, 10);
  roomInput.value = roomID;
  linkP.textContent = `Room Link: ${window.location.href}?room=${roomID}`;
  await getMedia();
  socket.emit('join_room', roomID);
};

// الانضمام إلى غرفة موجودة
joinBtn.onclick = async () => {
  const roomID = roomInput.value;
  if (!roomID) return alert('Please enter a Room ID');
  await getMedia();
  socket.emit('join_room', roomID);
};

// التحقق إذا جاء الزائر عبر رابط مع ?room=ID
window.onload = async () => {
  const params = new URLSearchParams(window.location.search);
  const roomID = params.get('room');
  if(roomID) {
    roomInput.value = roomID;
    await getMedia();
    socket.emit('join_room', roomID);
  }
};

// استقبال إشارات من Socket.io
socket.on('user_joined', async (id) => {
  const roomID = roomInput.value;
  const peer = createPeer(id, roomID);
  peers[id] = peer;

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit('signal', { roomID, target: id, data: { sdp: offer } });
});

socket.on('signal', async ({ id, data }) => {
  if (!peers[id]) peers[id] = createPeer(id, roomInput.value);
  const peer = peers[id];

  if(data.sdp) {
    await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if(data.sdp.type === 'offer') {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('signal', { roomID: roomInput.value, target: id, data: { sdp: answer } });
    }
  } else if(data.candidate) {
    await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});
