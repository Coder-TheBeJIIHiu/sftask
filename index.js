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

bot.command('uptime', async (ctx) => {
  try {
    const getInfoSafely = async (fn, defaultValue) => {
      try {
        return await fn();
      } catch (err) {
        console.error(`Ошибка при выполнении функции: ${err.message}`);
        return defaultValue;
      }
    };

    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    // Получаем данные безопасно
    const totalUsers = await getInfoSafely(() => User.countDocuments(), 'Не удалось получить данные');
    const activeUsersLast24h = await getInfoSafely(() =>
      User.countDocuments({
        lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      'Не удалось получить данные'
    );

    const webhookInfo = await getInfoSafely(() => bot.telegram.getWebhookInfo(), {});
    const webhookStatus = webhookInfo.url ? 'Активен' : 'Неактивен';
    const webhookUrl = webhookInfo.url || 'Не задан';
    const webhookPendingUpdates = webhookInfo.pending_update_count || 'Неизвестно';

    const totalGames = await getInfoSafely(() => Game.countDocuments(), 'Не удалось получить данные');
    const activeGames = await getInfoSafely(() =>
      Game.find({ started: true, completed: false }),
      []
    );
    const completedGames = await getInfoSafely(() => Game.find({ completed: true }), []);

    const activeGamesInfo = activeGames.map((game) => {
      const users = game.users.length;
      const startTime = new Date(game.startTime).toLocaleString();
      return `- Код: ${game.code}, Пользователи: ${users}, Старт: ${startTime}`;
    }).join('\n') || 'Нет активных игр';

    const longestGame = completedGames.sort((a, b) =>
      (new Date(b.endTime) - new Date(b.startTime)) -
      (new Date(a.endTime) - new Date(a.startTime))
    )[0];

    const avgPlayersPerGame = completedGames.length > 0
      ? completedGames.reduce((sum, game) => sum + game.users.length, 0) / completedGames.length
      : 'Недоступно';

    // Системная информация
    const totalMemory = (os.totalmem() / 1024 / 1024).toFixed(2);
    const freeMemory = (os.freemem() / 1024 / 1024).toFixed(2);
    const cpuUsage = os.loadavg().map(avg => avg.toFixed(2)).join(' / ');

    // Форматирование времени работы
    const seconds = Math.floor(uptime % 60);
    const minutes = Math.floor((uptime / 60) % 60);
    const hours = Math.floor((uptime / 3600) % 24);
    const days = Math.floor(uptime / 86400);

    // Сбор информации
    const info = `
📊 *Детальная информация о боте:*

🕒 *Время работы:* ${days} дней, ${hours} часов, ${minutes} минут, ${seconds} секунд
👥 *Общее количество пользователей:* ${totalUsers}
👤 *Активных за 24 часа:* ${activeUsersLast24h}

🎮 *Игры:*
  - *Всего игр:* ${totalGames}
  - *Активных:* ${activeGames.length}
  - *Завершенных:* ${completedGames.length}
  - *Самая долгая игра:* ${longestGame ? `${longestGame.code}, длительность: ${(new Date(longestGame.endTime) - new Date(longestGame.startTime)) / 60000} минут` : 'Нет данных'}
  - *Среднее количество игроков:* ${avgPlayersPerGame}

${activeGames.length ? `📋 *Информация об активных играх:*\n${activeGamesInfo}` : ''}

⚙️ *Системная информация:*
  - *Память:* ${freeMemory} MB свободно из ${totalMemory} MB
  - *Средняя нагрузка (1/5/15 мин):* ${cpuUsage}
  - *Использование памяти процесса:*
    - RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB
    - Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB
    - Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB

🌐 *Информация о вебхуке:*
  - *Статус:* ${webhookStatus}
  - *URL:* ${webhookUrl}
  - *Ожидающие обновления:* ${webhookPendingUpdates}

🕰️ *Время сервера:* ${new Date().toLocaleString()}
  `;

    // Отправка ответа
    await ctx.replyWithMarkdown(info);
  } catch (error) {
    console.error('Ошибка в команде /uptime:', error);
    ctx.reply('⚠️ Произошла ошибка при выполнении команды /uptime. Попробуйте позже.');
  }
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