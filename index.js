const { Telegraf, session, Scenes } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const registrationScene = require('./scenes/registration.js');
const menuScene = require('./scenes/menu.js');
const gameScene = require('./scenes/game.js');
const NBScene = require('./scenes/networkboost.js');
const app = express();
const port = process.env.PORT || 3000;

const User = require('./models/User');
const Game = require('./models/Game')
async function db() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Успешное подключение к базе данных');
    await bot.launch();
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    console.error(error.stack)
    //process.exit(1);
  }
}

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(session());
bot.use(async (ctx, next) => {
  const user = await User.findOne({ tgId: ctx.from.id });

  if (user) {
    if(!ctx.session) {
      ctx.session = {};
      ctx.session.user = user;
    }
  }
  await next();
})
const stage = new Scenes.Stage([registrationScene, menuScene, gameScene, NBScene].flat());
bot.use(stage.middleware());

bot.start(async (ctx) => {
  const user = await User.findOne({ tgId: ctx.from.id });
  const ref = ctx.startPayload
  if (ref) {
    if (!ctx.session.ref) {
      ctx.session.ref = {};
      ctx.session.ref = ref;
    }
    
  }
  if(!user) {
    return ctx.scene.enter('nameScene')
  }
  
  if (ctx.session.user.gameList.isActive) {
    return ctx.scene.enter('gameScene');
  }
  ctx.scene.enter('nameScene');
});

bot.on('text', async (ctx) => {
  if (ctx.session.user.gameList.isActive) {
    return ctx.scene.enter('gameScene');
  }
})

// Эндпоинт для получения всех игр
app.get('/', async (req, res) => {
  try {
    const games = await Game.find();
    res.json(games); // Возвращаем JSON с играми
  } catch (err) {
    res.status(500).json({ error: 'Ошибка при получении игр' });
  }
})

app.listen(port, async() => {
  console.log(`Server is running on port ${port}`);
  db()
})