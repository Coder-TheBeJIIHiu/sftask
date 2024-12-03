const { Scenes, Markup } = require('telegraf');
const GitHubFileFetcher = require('../utils/GitHubFileFetcher');
const getTop10WithExp = require('../utils/Top');
const crypto = require('crypto'); // Добавлен импорт crypto

const fetcher = new GitHubFileFetcher();

// Сцена меню
const menuScene = new Scenes.BaseScene('menuScene');

menuScene.enter(async (ctx) => {
  const helloFile = await fetcher.fetchFile('https://raw.githubusercontent.com/Coder-TheBeJIIHiu/SFEK-TASK/refs/heads/main/hello.txt');
  const quoteFile = await fetcher.fetchFile('https://raw.githubusercontent.com/Coder-TheBeJIIHiu/SFEK-TASK/refs/heads/main/quotes.txt')
  const quotes = quoteFile.split('\n')
  // Приветственное сообщение
  ctx.replyWithHTML(`${helloFile}\n\n<code>${quotes[crypto.randomInt(0, quotes.length)]}</code>`, Markup.inlineKeyboard([
    [
      Markup.button.callback('sᴇᴀʀᴄʜ 🔍 ', 'random'),
      // Markup.button.callback('ʟᴏᴠᴇ 🫶🏻', 'love')
    ],
    [
      Markup.button.callback('ᴘʀᴏꜰɪʟᴇ 👤', 'profile'),
      Markup.button.callback('ᴛᴏᴘ 📊', 'top')
    ],
    [
      Markup.button.callback('ɴᴇᴛᴡᴏʀᴋ ʙᴏᴏsᴛᴇʀ 📈', 'network_booster'),
    ],
    [
      Markup.button.callback('ʜᴏᴡ ᴛᴏ ᴘʟᴀʏ ❓', 'how_to_play')
    ]
  ]));
});

menuScene.action('network_booster', async (ctx) => {
  // ctx.scene.enter('NBScene');
  return await ctx.reply('❌ Функция ещё в разработке.')
})

menuScene.action('profile', async (ctx) => {
  const user = ctx.session.user; // Используем данные из ctx.session.user

    if (!user) {
      return ctx.reply('Профиль не найден. Пожалуйста, зарегистрируйтесь!');
    }

    // Формирование красивого профиля
    const genderIcon = user.gender === 'male' ? '👨‍💼' : '👩‍💼';
    const activeGameStatus = user.gameList.isActive
      ? '🎮 Сейчас играет'
      : '🛌 Не играет';

    // Последняя игра
    const lastGame =
      user.gameList.gameList.length > 0
        ? user.gameList.gameList[user.gameList.gameList.length - 1].gameId
        : null;

    const profileText = `
  <b>🌟 Профиль пользователя ${user.firstName} ${user.lastName[0]}.</b>

  ID: <code>${user._id}</code>
  Возраст: <b>${user.age} лет</b>
  Пол: <b>${genderIcon} ${user.gender === 'male' ? 'Мужской' : 'Женский'}</b>
  Курс: <b>${user.course}-й курс</b>
  Опыт: <b>🏆 ${user.exp} XP</b>
  Игр: <b>🎮 ${user.gameList.gameList.length}</b>
  
  Реферал: <b>https://t.me/task_shbot/?start=${user._id} (${user.joins.length})</b>

  🎲 Статус игр: <b>${activeGameStatus}</b>
  ${
    lastGame
      ? `Последняя игра: <b>ID ${lastGame}</b>`
      : '❌ Нет данных о последних играх'
  }
    `;

    // Инлайн-кнопки
    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback('🎮 Мои игры', 'my_games')],
      [Markup.button.callback('🔄 Обновить профиль', 'update_profile')],
    ]);

    await ctx.reply(profileText.trim(), {
      parse_mode: 'HTML',
    })
})

// Обработка кнопок
menuScene.action('random', async (ctx) => {
  ctx.scene.enter('gameScene')
});

menuScene.action('top', async (ctx) => {
  try {
    const { topUsers, userRank, userExp } = await getTop10WithExp(ctx.session.user._id);

    // Формирование текста для топ-10
    let response = '<b>🏆 Топ-10</b> пользователей по опыту:\n\n';
    topUsers.forEach((user, index) => {
      response += `${index + 1}. <a href="tg://user?id=${user.tgId}">${user.firstName} ${user.lastName[0]}.</a> — <b>${user.exp} опыта</b>\n`;
    });

    response += '\n';

    if (userExp > 1) {
      response += `Ваше место в рейтинге:<b> ${userRank}-е место</b>\n`;
      response += `Ваш опыт:<b> ${userExp}</b>`;
    } else {
      response += 'Вы ещё не в рейтинге. Заработайте больше опыта!';
    }

    await ctx.reply(response, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Ошибка при выполнении команды /top:', error);
    await ctx.reply('Произошла ошибка при получении топа. Попробуйте позже.');
  }
})

menuScene.action('how_to_play', async (ctx) => {
  try {
    const startText = await fetcher.fetchFile("https://raw.githubusercontent.com/Coder-TheBeJIIHiu/SFEK-TASK/refs/heads/main/howtoplay.txt");
    if (!startText) {
      return ctx.reply('Не удалось загрузить файл с инструкциями.');
    }

    const message = await ctx.reply(startText, {
      parse_mode: 'HTML'
    });

    setTimeout(() => {
      ctx.deleteMessage(message.message_id);
    }, 20000);
  } catch (err) {
    console.error(err);
    ctx.reply('Произошла ошибка при загрузке файла.');
  }
});

module.exports = menuScene;