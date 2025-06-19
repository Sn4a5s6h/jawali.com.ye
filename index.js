// server.js
require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// إعدادات البوت (مخفية عن المتصفح)
const botConfig = {
  botToken: process.env.BOT_TOKEN,
  chatId: process.env.CHAT_ID
};

// تقديم ملفات المشروع
app.use(express.static(__dirname));

// إرسال صفحات HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// إرسال إعدادات البوت بشكل ديناميكي
app.get('/config', (req, res) => {
  res.json(botConfig);
});

// تشغيل الخادم
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
