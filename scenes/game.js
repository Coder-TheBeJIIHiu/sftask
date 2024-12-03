const { Scenes } = require('telegraf');
const Game = require('../models/Game');
const User = require('../models/User');
const search = require('../utils/Search');
const crypto = require('crypto');
const GitHubFileFetcher = require('../utils/GitHubFileFetcher')

const gameScene = new Scenes.BaseScene('gameScene');

const fetcher = new GitHubFileFetcher();

const EXP_WINNER = 100; // Опыта для победителя
const EXP_RANDOM_USER_MULTIPLIER = 0.5; // Множитель опыта для рандомного пользователя

// При входе в игру
gameScene.enter(async (ctx) => {
  const user = ctx.session.user;

  if (!user) {
    return ctx.reply('Произошла ошибка. Попробуйте позже.');
  }

  // Ищем активную игру
  let activeGame = await Game.findOne({
    users: user._id,
    completed: false,
  });

  // Если активная игра найдена, восстанавливаем её
  if (activeGame) {
    if(activeGame.users[1].tgId === ctx.from.id) return ctx.reply('Вы уже состоите в этой игре.');
    const otherUserId = activeGame.users.find(id => id !== user._id);
    const randomUser = await User.findById(otherUserId);

    await ctx.replyWithHTML(`
      🎮 <b>Вы вернулись в активную игру!</b>

      🔎 <i>Ваша задача:</i> Найти студента и выполнить задание:  
      📝 <b>${activeGame.task}</b>(Да, знаю очень странные задания, скоро исправим, отправляйте свои задания в Instagram)

      📋 <b>Информация:</b>  
      👤 Имя: <b>${randomUser.lastName} ${randomUser.firstName}</b>  
      🎓 Курс: <b>${randomUser.course}</b>

      💬 После выполнения задания введите код!
      
      Удачи! 🍀
    `);

    ctx.scene.state.game = activeGame;
    return;
  }

  // Ищем случайного пользователя для новой игры
  const randomUser = await search(user);

  if (!randomUser) {
    return ctx.reply('Нет доступных игроков. Попробуйте позже.');
  }

  const taskFile = await fetcher.fetchFile('https://raw.githubusercontent.com/Coder-TheBeJIIHiu/SFEK-TASK/refs/heads/main/all.txt')
  const tasks = taskFile.split('\n')

  // Создаем новую игру
  const newGame = new Game({
    users: [user._id, randomUser._id],
    task: tasks[0, crypto.randomInt(0, tasks.length)],
  });

  await newGame.save();

    try {
      // Получаем информацию о фотографиях профиля
      const photos = await ctx.telegram.getUserProfilePhotos(randomUser.tgId);

      if (photos.total_count === 0) {
        return ctx.reply('Не удалось получить фотографии профиля пользователя.');
      } else {

        // Отправляем до 3 фотографий, используя file_id
        const sendPhotoPromises = photos.photos.slice(0, 3).map((photoGroup) => {
          const fileId = photoGroup[photoGroup.length - 1].file_id; // Берем самое большое фото
          return ctx.replyWithPhoto(fileId);
        });

        await Promise.all(sendPhotoPromises);
      }
    } catch (error) {
      console.error('Ошибка при получении фотографий:', error);
      ctx.reply('Произошла ошибка при получении фотографий.');
  }

  await ctx.replyWithHTML(`
    🎮 <b>Игра началась!</b>

    🔎 <i>Ваша задача:</i> Найти студента и выполнить задание:  
    📝 <b>${newGame.task}</b>(Да, знаю очень странные задания, скоро исправим, отправляйте свои задания в Instagram)

    📋 <b>Информация:</b>  
    👤 Имя: <b>${randomUser.lastName} ${randomUser.firstName}</b>  
    🎓 Курс: <b>${randomUser.course}</b>

    💬 После выполнения задания введите код. Удачи! 🍀
  `);

  await ctx.telegram.sendMessage(
    randomUser.tgId,
    `
    🎮 <b>Игра началась!</b>

    К вам обратится студент, которому нужно выполнить задание.  
    Код для завершения игры: 📝 <b>code_${newGame.code}</b>  
    Удачи! 🍀
    `,
    { parse_mode: 'HTML' }
  );

  await User.findByIdAndUpdate(user._id, { 'gameList.isActive': true });
  await User.findByIdAndUpdate(randomUser._id, { 'gameList.isActive': true });

  ctx.scene.state.game = newGame;
});

// Обработка завершения игры
gameScene.on('text', async (ctx) => {
  const inputCode = ctx.message.text.trim();
  const game = ctx.scene.state.game;

  if (!game) {
    return ctx.reply('Нет активной игры.');
  }

  if (inputCode === `code_${game.code}`) {

    try {
      console.log(game)
      const winner = await User.findById(game.users[0]);
      const randomUser = await User.findById(game.users[1]);

      const winnerId = winner._id;
      const randomUserId = randomUser._id;
      
      const expRandomUser = Math.round(EXP_WINNER * EXP_RANDOM_USER_MULTIPLIER);

      // Обновляем опыт
      await Promise.all([
        User.findByIdAndUpdate(winnerId, {
          $inc: { exp: EXP_WINNER * 2 },
          $set: { 'gameList.isActive': false },
        }),
        User.findByIdAndUpdate(randomUserId, {
          $inc: { exp: expRandomUser },
          $set: { 'gameList.isActive': false },
        }),
        Game.findByIdAndUpdate(game._id, { $set: { completed: true, started: false } }),
      ]);

      // Раскрываем информацию
      await ctx.replyWithHTML(`
        ✅ <b>Игра завершена успешно!</b>

        🏆 Вы получили <b>${EXP_WINNER * 2} опыта</b>.  
        🎉 Ваш партнер получил <b>${expRandomUser} опыта</b>.

        👤 <b>Информация:</b>  
        Имя: <b>${randomUser.firstName} ${randomUser.lastName}</b>  
        Возраст: <b>${randomUser.age}</b>  
        Курс: <b>${randomUser.course}</b>  
      `);

      ctx.telegram.sendMessage(randomUser.tgId, `
        ✅ <b>Игра завершена!</b>
        👤 Ваш партнер был: <b>${winner.firstName} ${winner.lastName}</b>.
        📈 Возраст: <b>${winner.age}</b>  
        🔢 Курс: <b>${winner.course}</b> 
        🏆 Вы получили <b>${expRandomUser} опыта</b>. Спасибо за участие!
      `, { parse_mode: 'HTML' });
      ctx.session.game = null;

      ctx.scene.enter("nameScene");
    } catch (error) {
      console.error('Ошибка при завершении игры:', error);
      ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
  } else {
    ctx.reply('Неверный код. Попробуйте ещё раз.');
  }
});

module.exports = gameScene;