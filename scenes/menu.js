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
        [Markup.button.callback('ɢᴀᴍᴇs 🎰', 'games')],
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

module.exports = menuScene;