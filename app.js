const socket = io();
let localStream;
let peers = {};

const localVideoDiv = document.getElementById('localVideoDiv');
const remoteVideoDiv = document.getElementById('remoteVideoDiv');

const startBtn = document.getElementById('startBtn');
const roomInput = document.getElementById('roomInput');
const linkP = document.getElementById('link');

async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const localVideo = document.createElement('video');
    localVideo.srcObject = localStream;
    localVideo.autoplay = true;
    localVideo.muted = true; // كتم الصوت المحلي لتجنب الصدى
    localVideoDiv.appendChild(localVideo);
  } catch (err) {
    alert("Please allow access to camera and microphone!");
    console.error(err);
  }
}

function createPeer(socketID, roomID) {
  const peer = new RTCPeerConnection();
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  peer.ontrack = (event) => {
    remoteVideoDiv.innerHTML = ""; // تنظيف الفيديو السابق
    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.autoplay = true;
    remoteVideoDiv.appendChild(remoteVideo);
  };

  peer.onicecandidate = (event) => {
    if(event.candidate) {
      socket.emit('signal', { roomID, target: socketID, data: { candidate: event.candidate } });
    }
  };

  return peer;
}

// بدء الكاميرا والانضمام للغرفة
startBtn.onclick = async () => {
  let roomID = roomInput.value;
  if(!roomID) roomID = Math.random().toString(36).substring(2,10);
  roomInput.value = roomID;
  linkP.textContent = `Room Link: ${window.location.origin}?room=${roomID}`;

  await getMedia();
  socket.emit('join_room', roomID);
};

// قراءة الرابط عند فتح الصفحة
const urlParams = new URLSearchParams(window.location.search);
const roomFromLink = urlParams.get('room');
if(roomFromLink) roomInput.value = roomFromLink;

// عند دخول مستخدم جديد
socket.on('user_joined', async (id) => {
  const roomID = roomInput.value;
  const peer = createPeer(id, roomID);
  peers[id] = peer;

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit('signal', { roomID, target: id, data: { sdp: offer } });
});

// استقبال الإشارات
socket.on('signal', async ({ id, data }) => {
  if(id === socket.id) return;

  if(!peers[id]) peers[id] = createPeer(id, roomInput.value);
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
