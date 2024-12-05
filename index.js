const { Telegraf, session, Scenes } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const registrationScene = require('./scenes/registration.js');
const menuScene = require('./scenes/menu.js');
const gameScene = require('./scenes/game.js');
const NBScene = require('./scenes/networkboost.js');
const app = express();
const port = process.env.PORT || 3000;
const os = require('os');

const User = require('./models/User');
const Game = require('./models/Game');

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Успешно подключено к базе данных!');
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    console.error(error.stack);
  }
}

const generateRandomString = (length = 10) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
};

const randomPath = generateRandomString(16);
const url = `${process.env.WEBHOOK_URL}/${randomPath}`;
const bot = new Telegraf(process.env.BOT_TOKEN);

async function checkWebhook() {
  const currentWebhook = await bot.telegram.getWebhookInfo();

  if (currentWebhook.url && currentWebhook.url !== url) {
    console.log('⚠️ Обнаружен старый вебхук:', currentWebhook.url);
    await bot.telegram.deleteWebhook();
    console.log('✅ Старый вебхук удален.');
  }
  app.use(bot.webhookCallback(`/${randomPath}`));
  await bot.telegram.setWebhook(url);
  console.log('✅ Новый вебхук установлен.');
}
(async() => { 
  await checkWebhook();
})()

bot.use(session());
bot.use(async (ctx, next) => {
  if (!ctx.session) ctx.session = {};
  const user = await User.findOne({ tgId: ctx.from.id });
  if (user) ctx.session.user = user;
  await next();
});

const stage = new Scenes.Stage([registrationScene, menuScene, gameScene, NBScene].flat()); // flat() НЕ УБИРАТЬ
bot.use(stage.middleware());

bot.start(async (ctx) => {
  const user = await User.findOne({ tgId: ctx.from.id });
  const ref = ctx.startPayload;

  if (ref && !ctx.session.ref) ctx.session.ref = ref;

  if (!user) return ctx.scene.enter('nameScene');
  if (ctx.session.user?.gameList?.isActive) return ctx.scene.enter('gameScene');
  ctx.scene.enter('menuScene');
});



bot.on('text', async (ctx) => {
  if (ctx.session.user?.gameList?.isActive) ctx.scene.enter('gameScene');
});

app.get('/', async (req, res) => {
  try {
    const games = await Game.find();
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: 'Не удалось получить игры.' });
  }
});

app.listen(port, async () => {
  console.log(`Сервер работает на порту ${port}`);
  console.log(`Вебхук установлен по адресу: ${url}`);
  await connectToDatabase();
});

bot.catch((err) => {
  console.error('Произошла ошибка в боте:', err);
});