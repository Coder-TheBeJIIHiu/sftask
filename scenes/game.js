const { Scenes } = require('telegraf');
const Game = require('../models/Game');
const User = require('../models/User');
const search = require('../utils/Search');
const crypto = require('crypto');
const GitHubFileFetcher = require('../utils/GitHubFileFetcher');

const gameScene = new Scenes.BaseScene('gameScene');

const fetcher = new GitHubFileFetcher();

const EXP_WINNER = 100; // Опыта для победителя
const EXP_RANDOM_USER_MULTIPLIER = 0.5; // Множитель опыта для рандомного пользователя

// Функция для обработки ошибок
async function handleDebugError(ctx, error, errorCode = 'UNKNOWN') {
  console.error(`[${errorCode}] Ошибка:`, error.message);
  console.error(`[${errorCode}] Stack trace:`, error.stack);

  // Унифицированное сообщение об ошибке
  const errorMessage = `
    ❗ Произошла ошибка
    🆔 Код ошибки: ${errorCode}
    📜 Подробности: ${error.message}
    🤡 Error stack:
    > ${error.stack}
    
    Пожалуйста, сообщите администратору: @sfek_hub!
  `;

  try {
    await ctx.reply(errorMessage);
  } catch (sendError) {
    console.error(`[${errorCode}] Не удалось отправить сообщение об ошибке:`, sendError);
  }
}

// При входе в игру
gameScene.enter(async (ctx) => {
  try {
    const user = await User.findOne({ tgId: ctx.from.id });

    if (!user) {
      return await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
    const lastGameId = await getLastGameId(user._id);
    // Проверяем, есть ли активная игра
    let activeGame = await Game.findOne({
      _id: { $in: lastGameId },
      completed: false,
    });

    if (activeGame) {
      if (!user.gameList.isActive) {
        return;
      }

      const game = activeGame;
      const fiveMinutesLater = new Date(activeGame.startTime.getTime() + 5 * 60 * 1000)
      
      if (Date.now() > fiveMinutesLater) {
        // Завершаем игру досрочно
        await Game.findByIdAndUpdate(game._id, { 
          completed: true,
          started: false,
        });

        // Обновляем статус игроков
        await Promise.all([
            User.findByIdAndUpdate(game.users[0], { $set: { 'gameList.isActive': false } }),
            User.findByIdAndUpdate(game.users[1], { $set: { 'gameList.isActive': false } }),
        ]);

          // Получаем информацию об игроках
        const [user1, user2] = await Promise.all([
          User.findById(game.users[0]),
          User.findById(game.users[1]),
        ]);

          // Уведомляем игроков и раскрываем код
        const message = `
            ❌ <b>Игра завершена досрочно из-за неактивности.</b>

            🔓 <b>Информация об участниках:</b>
            👤 Игрок 1: <b>${user1.lastName} ${user1.firstName}</b>
            👤 Игрок 2: <b>${user2.lastName} ${user2.firstName}</b>

            📝 <b>Код игры:</b> <code>${game.code}</code>
          `;

        await Promise.all([
            ctx.telegram.sendMessage(user1.tgId, message, { parse_mode: 'HTML' }),
            ctx.telegram.sendMessage(user2.tgId, message, { parse_mode: 'HTML' }),
          ]);

          // Завершаем сцену
        return ctx.scene.enter('nameScene');
      }
      
      const gameOwner = await User.findById(activeGame.users[0]);
      const randomUser = await User.findById(activeGame.users[1]);

      if (activeGame.users[1].tgId === ctx.from.id) {
        return ctx.reply('Вы уже состоите в этой игре.');
      }

      await ctx.telegram.sendMessage(gameOwner.tgId, `
        🎮 <b>Вы вернулись в активную игру!</b>

        🔎 <i>Ваша задача:</i> Найти студента и выполнить задание:  
        📝 <b>${activeGame.task}</b>

        📋 <b>Информация:</b>  
        👤 Имя: <b>${randomUser.lastName} ${randomUser.firstName}</b>  
        🎓 Курс: <b>${randomUser.course}</b>

        💬 После выполнения задания введите код!

        Удачи! 🍀
      `, { parse_mode: 'HTML' });

      return ctx.scene.state.game = activeGame;
    }
    
    // Ищем случайного пользователя для новой игры
    const randomUser = await search(user);

    if (!randomUser) {
      return ctx.reply('Нет доступных игроков. Попробуйте позже.');
    }

    // Получаем задания из GitHub
    const taskFile = await fetcher.fetchFile('https://raw.githubusercontent.com/Coder-TheBeJIIHiu/SFEK-TASK/refs/heads/main/all.txt');
    const tasks = taskFile.split('\n');
    const randomTask = tasks[crypto.randomInt(0, tasks.length)];

    // Создаем новую игру
    const newGame = new Game({
      users: [user._id, randomUser._id],
      task: randomTask,
      code: crypto.randomInt(100000, 999999),
    });
   
    try {
      await Promise.all([
        clearTimeout(ctx.session.timeout),
        newGame.save(),
        addGame(user._id, newGame._id),
        addGame(randomUser._id, newGame._id),
        User.updateMany(
          { _id: { $in: [user._id, randomUser._id] } },
          { $set: { 'gameList.isActive': true } },
        ),
      ]);
    } catch (error) {
      await handleDebugError(ctx, error, 'GAME_SAVE_ERROR');
    }

    // Отправляем фото профиля и детали игры
    try {
      const photos = await ctx.telegram.getUserProfilePhotos(randomUser.tgId);
      if (photos.total_count > 0) {
        const photoGroup = photos.photos.slice(0, 3);
        for (const group of photoGroup) {
          const fileId = group[group.length - 1].file_id;
          await ctx.replyWithPhoto(fileId);
        }
      } else {
        ctx.reply('Не удалось получить фотографии профиля пользователя.');
      }
    } catch (err) {
      await handleDebugError(ctx, err, 'PROFILE_PHOTO_ERROR');
    }

    await ctx.replyWithHTML(`
      🎮 <b>Игра началась!</b>

      🔎 <i>Ваша задача:</i> Найти студента и выполнить задание:  
      📝 <b>${newGame.task}</b>

      📋 <b>Информация:</b>  
      👤 Имя: <b>${randomUser.lastName} ${randomUser.firstName}</b>  
      🎓 Курс: <b>${randomUser.course}</b>

      💬 После выполнения задания введите код. Удачи! 🍀
    `);

    await ctx.telegram.sendMessage(randomUser.tgId, `
      🎮 <b>Игра началась!</b>

      К вам обратится студент, которому нужно выполнить задание.  
      Код для завершения игры: 📝 <b>code_${newGame.code}</b>  
      Удачи! 🍀
    `, { parse_mode: 'HTML' });

    ctx.scene.state.game = newGame;
    
    // Устанавливаем новый таймер
    ctx.session.timeout = setTimeout(async () => {
      const game = ctx.scene.state.game;
      
      if (game && !game.completed) {
        // Завершаем игру досрочно
        await Game.findByIdAndUpdate(game._id, { 
          completed: true,
          started: false,
        });

        // Обновляем статус игроков
        await Promise.all([
            User.findByIdAndUpdate(game.users[0], { $set: { 'gameList.isActive': false } }),
            User.findByIdAndUpdate(game.users[1], { $set: { 'gameList.isActive': false } }),
        ]);

          // Получаем информацию об игроках
        const [user1, user2] = await Promise.all([
          User.findById(game.users[0]),
          User.findById(game.users[1]),
        ]);

          // Уведомляем игроков и раскрываем код
        const message = `
            ❌ <b>Игра завершена досрочно из-за неактивности.</b>

            🔓 <b>Информация об участниках:</b>
            👤 Игрок 1: <b>${user1.lastName} ${user1.firstName}</b>
            👤 Игрок 2: <b>${user2.lastName} ${user2.firstName}</b>

            📝 <b>Код игры:</b> <code>${game.code}</code>
          `;

        await Promise.all([
            ctx.telegram.sendMessage(user1.tgId, message, { parse_mode: 'HTML' }),
            ctx.telegram.sendMessage(user2.tgId, message, { parse_mode: 'HTML' }),
          ]);

          // Завершаем сцену
        return ctx.scene.enter('nameScene');
      }
    }, 5 * 60 * 1000); // 5 минут
  } catch (error) {
    await handleDebugError(ctx, error, 'GAME_ENTRY_ERROR');
  }
});

// Обработка завершения игры
gameScene.on('text', async (ctx) => {
  try {
    const inputCode = ctx.message.text.trim();
    const game = ctx.scene.state.game;

    if (!game) {
      return ctx.scene.enter('nameScene');
    }

    if (game.users[1] === ctx.from.id) {
      await Promise.all([
        User.findByIdAndUpdate(game.users[0], {
          $set: { 'gameList.isActive': false },
        }),
        User.findByIdAndUpdate(game.users[1], {
          $set: { 'gameList.isActive': false },
        }),
        Game.findByIdAndUpdate(game._id, { 
          started: false,
          completed: true,
        }),
      ]);
      await ctx.reply('❌ Игра закончена досрочно!');
      return ctx.scene.enter('nameScene');
    }

    if (inputCode === `code_${game.code}`) {
      const winner = await User.findById(game.users[0]);
      const randomUser = await User.findById(game.users[1]);
      const expRandomUser = Math.round(EXP_WINNER * EXP_RANDOM_USER_MULTIPLIER);

      await Promise.all([
        User.findByIdAndUpdate(winner._id, {
          $inc: { exp: EXP_WINNER * 2 },
          $set: { 'gameList.isActive': false },
        }),
        User.findByIdAndUpdate(randomUser._id, {
          $inc: { exp: expRandomUser },
          $set: { 'gameList.isActive': false },
        }),
        Game.findByIdAndUpdate(game._id, { 
          started: false,
          completed: true,
        }),
      ]);

      await ctx.replyWithHTML(`
        ✅ <b>Игра завершена успешно!</b>

        🏆 Вы получили <b>${EXP_WINNER * 2} опыта</b>.  
        🎉 Ваш партнер получил <b>${expRandomUser} опыта</b>.
      `);

      await ctx.telegram.sendMessage(randomUser.tgId, `
        ✅ <b>Игра завершена!</b>
        🏆 Вы получили <b>${expRandomUser} опыта</b>. Спасибо за участие! (Напишите /start, чтобы попасть в меню)
      `, { parse_mode: 'HTML' });

      ctx.scene.enter('nameScene');
    } else {
      ctx.reply('Неверный код. Попробуйте ещё раз.');
    }
  } catch (error) {
    await handleDebugError(ctx, error, 'GAME_FINISH_ERROR');
  }
});

// добавляем игру в gameList
async function addGame(userId, gameId) {
  try {
    await User.findByIdAndUpdate(
      userId,
      { $push: { 'gameList.gameList': { gameId } } },
      { new: true }
    );
  } catch (err) {
    console.error('ошибка', err);
  }
}

async function getLastGameId(userId) {
  const user = await User.findById(userId)
  if (user && user.gameList.gameList.length > 0) {
    const lastGame = user.gameList.gameList[user.gameList.gameList.length - 1];
    return lastGame.gameId;
  } else {
    return null;
  }
}

module.exports = gameScene;