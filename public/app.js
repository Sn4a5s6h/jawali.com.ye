const socket = io();
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

sendBtn.onclick = () => {
  const msg = { user: "أنا", text: messageInput.value };
  socket.emit('chat_message', msg);
  messageInput.value = "";
};

socket.on('chat_message', (msg) => {
  const div = document.createElement('div');
  div.textContent = `${msg.user}: ${msg.text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// WebRTC
const peer = new RTCPeerConnection();

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
.then(stream => {
  localVideo.srcObject = stream;
  stream.getTracks().forEach(track => peer.addTrack(track, stream));
});

peer.ontrack = (event) => { remoteVideo.srcObject = event.streams[0]; };

socket.on('signal', async ({ id, data }) => {
  if (data.sdp) {
    await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if (data.sdp.type === 'offer') {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('signal', { target: id, data: { sdp: answer } });
    }
  } else if (data.candidate) {
    await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

peer.onicecandidate = (event) => {
  if (event.candidate) socket.emit('signal', { data: { candidate: event.candidate } });
};

(async () => {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit('signal', { data: { sdp: offer } });
})(); 
