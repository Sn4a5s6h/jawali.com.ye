// server.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.static(__dirname));
app.use(bodyParser.json());

// 🔐 إعدادات البوت (تبقى داخل الخادم فقط)
const botToken = '6767498865:AAFibdms3ba_9bH8vqD6X92DrkiRHkPEn2w';
const chatId = '7057346640';

// 📩 استقبال الرسائل من المستخدم وإرسالها للبوت
app.post('/send-message', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).send('No message provided');

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message
    });
    res.status(200).send('تم إرسال الرسالة');
  } catch (err) {
    res.status(500).send('فشل الإرسال');
  }
});

// 🏠 صفحة HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
