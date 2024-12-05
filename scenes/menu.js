const { Scenes, Markup } = require('telegraf');
const GitHubFileFetcher = require('../utils/GitHubFileFetcher');
const getTop10WithExp = require('../utils/Top');
const crypto = require('crypto'); // импорт crypto
const os = require('os'); // импорт модуля os

const Game = require('../models/Game');
const User = require('../models/User');

const fetcher = new GitHubFileFetcher();

// создание сцены меню
const menuScene = new Scenes.BaseScene('menuScene');

menuScene.enter(async (ctx) => {
  try {
    // загрузка файлов
    const helloFile = await fetcher.fetchFile('https://raw.githubusercontent.com/Coder-TheBeJIIHiu/SFEK-TASK/refs/heads/main/hello.txt');
    const quoteFile = await fetcher.fetchFile('https://raw.githubusercontent.com/Coder-TheBeJIIHiu/SFEK-TASK/refs/heads/main/quotes.txt');

    if (!helloFile || !quoteFile) {
      return ctx.reply('❌ Не удалось загрузить приветственное сообщение или цитаты.');
    }

    const quotes = quoteFile.split('\n');
    const randomQuote = quotes[crypto.randomInt(0, quotes.length)];

    await ctx.replyWithHTML(
      `${helloFile}\n\n<code>${randomQuote}</code>`,
      Markup.inlineKeyboard([
        [Markup.button.callback('sᴇᴀʀᴄʜ 🔍 ', 'search')],
        [Markup.button.callback('ᴘʀᴏꜰɪʟᴇ 👤', 'profile'), Markup.button.callback('ᴛᴏᴘ 📊', 'top')],
        [Markup.button.callback('ɢᴀᴍᴇs 🎰', 'games'),
        Markup.button.callback('ʙᴏᴛ sᴛᴀᴛs', 'botstats')],
        [Markup.button.callback('ʜᴏᴡ ᴛᴏ ᴘʟᴀʏ ❓', 'how_to_play')]
      ])
    );
  } catch (err) {
    console.error('Ошибка при загрузке файлов:', err);
    ctx.reply('❌ Произошла ошибка при загрузке данных.');
  }
});

// обработка кнопки network_booster
menuScene.action('network_booster', async (ctx) => {
  await ctx.reply('❌ Функция ещё в разработке.');
});

// обработка профиля
menuScene.action('profile', async (ctx) => {
  try {
    const user = ctx.session.user;

    if (!user) {
      return ctx.reply('❌ Профиль не найден. Пожалуйста, зарегистрируйтесь.');
    }

    const genderIcon = user.gender === 'male' ? '👨‍💼' : '👩‍💼';
    const activeGameStatus = user.gameList?.isActive ? '🎮 Сейчас играет' : '🛌 Не играет';
    const lastGame = user.gameList?.gameList?.length > 0
      ? user.gameList.gameList[user.gameList.gameList.length - 1].gameId
      : '❌ Нет данных о последних играх';

    const profileText = `
<b>🌟 Профиль пользователя ${user.firstName} ${user.lastName?.[0]}.</b>

ID: <code>${user._id}</code>
Возраст: <b>${user.age} лет</b>
Пол: <b>${genderIcon} ${user.gender === 'male' ? 'Мужской' : 'Женский'}</b>
Курс: <b>${user.course || '—'}-й курс</b>
Опыт: <b>🏆 ${user.exp || 0} XP</b>
Игр: <b>🎮 ${user.gameList?.gameList?.length || 0}</b>

Реферал: <b>https://t.me/task_shbot/?start=${user._id} (${user.joins?.length || 0})</b>

🎲 Статус игр: <b>${activeGameStatus}</b>
Последняя игра: <b>${lastGame}</b>
    `.trim();

    await ctx.reply(profileText, {
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error('Ошибка при отображении профиля:', err);
    ctx.reply('❌ Произошла ошибка при загрузке профиля.');
  }
});

// обработка топа
menuScene.action('top', async (ctx) => {
  try {
    const { topUsers, userRank, userExp } = await getTop10WithExp(ctx.session.user?._id || '');
    let response = '<b>🏆 Топ-10 пользователей по опыту:</b>\n\n';

    topUsers.forEach((user, index) => {
      response += `${index + 1}. <a href="tg://user?id=${user.tgId}">${user.firstName} ${user.lastName?.[0]}.</a> — <b>${user.exp} опыта</b>\n`;
    });

    if (userRank && userExp) {
      response += `\nВаше место в рейтинге: <b>${userRank}-е место</b>\nВаш опыт: <b>${userExp}</b>`;
    } else {
      response += '\n❌ Вы ещё не в рейтинге. Заработайте больше опыта!';
    }

    await ctx.reply(response, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Ошибка при получении топа:', err);
    ctx.reply('❌ Произошла ошибка при получении топа. Попробуйте позже.');
  }
});

// обработка инструкции
menuScene.action('how_to_play', async (ctx) => {
  try {
    const startText = await fetcher.fetchFile('https://raw.githubusercontent.com/Coder-TheBeJIIHiu/SFEK-TASK/refs/heads/main/howtoplay.txt');

    if (!startText) {
      return ctx.reply('❌ Не удалось загрузить файл с инструкциями.');
    }

    const message = await ctx.reply(startText, { parse_mode: 'HTML' });
    setTimeout(() => ctx.deleteMessage(message.message_id), 20000);
  } catch (err) {
    console.error('Ошибка при загрузке инструкции:', err);
    ctx.reply('❌ Произошла ошибка при загрузке файла.');
  }
});


menuScene.action('search', async (ctx) => {
  ctx.scene.enter('gameScene');
})

menuScene.action('games', async (ctx) => {
  try {
    const games = await Game.find()
      .sort({ startTime: -1 }) // Сортировка по дате начала в порядке убывания
      .limit(10)
      .populate('users', 'firstName'); // Заполняем массив пользователей (например, только их имя)

    if (games.length === 0) {
      return ctx.reply('Последние игры отсутствуют.');
    }

    // Формируем красивый текст для вывода
    let message = '📋 *Последние 10 игр:*\n\n';
    games.forEach((game, index) => {
      const players = game.users.map(user => user.firstName).join(' ищет ') || 'Игроки отсутствуют';
      message += `*Игра ${index + 1}:*\n` +
        `- Задача: ${game.task}\n` +
        `- Код: ${game.code}\n` +
        `- Время начала: ${new Date(game.startTime).toLocaleString()}\n` +
        `- Игроки: ${players}\n` +
        `- Статус: ${game.completed ? 'Завершена' : 'В процессе'}\n\n`;
    });

    return ctx.replyWithMarkdown(message);
  } catch (error) {
    console.error('Ошибка получения игр:', error);
    return ctx.reply('Произошла ошибка при получении списка игр.');
  }
})

menuScene.action('botstats', async (ctx) => {
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
})

module.exports = menuScene;