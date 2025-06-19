require('dotenv').config();
const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('public'));

let botToken = process.env.BOT_TOKEN;
let chatId = process.env.CHAT_ID;

app.get('/config', (req, res) => {
  res.json({ botToken, chatId });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
