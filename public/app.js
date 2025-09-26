const socket = io();

// تسجيل
const regForm = document.getElementById("registerForm");
if (regForm) {
  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const res = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      alert("تم التسجيل بنجاح، سجل الدخول الآن");
      window.location.href = "/login.html";
    } else alert(data.message);
  });
}

// دخول
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      window.location.href = data.redirect;
    } else alert(data.message);
  });
}

// شات
const sendBtn = document.getElementById("sendBtn");
if (sendBtn) {
  sendBtn.onclick = () => {
    const msg = document.getElementById("msgInput").value;
    socket.emit("chat_message", msg);
    document.getElementById("msgInput").value = "";
  };
}

socket.on("chat_message", (msg) => {
  const div = document.createElement("div");
  div.textContent = msg;
  document.getElementById("messages").appendChild(div);
});

// فيديو
const localVideo = document.getElementById("localVideo");
if (localVideo) {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localVideo.srcObject = stream;
    });
}
