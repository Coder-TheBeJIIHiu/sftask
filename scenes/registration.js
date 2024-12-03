const { Scenes, Markup } = require('telegraf');
const User = require('../models/User');
const guessGender = require('../utils/Gender');
const guessAge = require('../utils/Age');

// Универсальная кнопка "Начать заново"
const restartButton = Markup.inlineKeyboard([
  Markup.button.callback('🔄 Начать заново', 'restart_registration'),
]);

// Общий обработчик кнопки "Начать заново"
async function handleRestart(ctx) {
  ctx.session.registrationData = null;
  ctx.scene.enter('nameScene');
}

// Регулярное выражение для проверки имени/фамилии
const nameRegex = /^[А-Яа-яҚқҒғҮүҰұӘәӨөІіҺһЁё\s'-]+$/;

// Сцена: ввод имени
const nameScene = new Scenes.BaseScene('nameScene');
nameScene.enter(async (ctx) => {
  const user = await User.findOne({ tgId: ctx.from.id });

  if (!user) {
    return ctx.reply(
      '👋 Добро пожаловать! Давайте начнем регистрацию. Напишите ваше имя:'
    );
  }

  return ctx.scene.enter('menuScene');
});
nameScene.on('text', (ctx) => {
  const firstName = ctx.message.text.trim();

  if (!nameRegex.test(firstName)) {
    return ctx.reply(
      '❗ Имя должно содержать только буквы кириллицы (включая казахский алфавит), пробелы или дефисы.',
      restartButton
    );
  }

  ctx.session.registrationData = { firstName };
  ctx.scene.enter('lastNameScene');
});
nameScene.on('message', (ctx) =>
  ctx.reply('❗ Пожалуйста, введите текст.', restartButton)
);
nameScene.action('restart_registration', handleRestart);

// Сцена: ввод фамилии
const lastNameScene = new Scenes.BaseScene('lastNameScene');
lastNameScene.enter((ctx) =>
  ctx.reply('😊 Отлично! Теперь введите вашу фамилию:', restartButton)
);
lastNameScene.on('text', async (ctx) => {
  const lastName = ctx.message.text.trim();

  if (!nameRegex.test(lastName)) {
    return ctx.reply(
      '❗ Фамилия должна содержать только буквы кириллицы (включая казахский алфавит), пробелы или дефисы.',
      restartButton
    );
  }

  ctx.session.registrationData.lastName = lastName;

  const user = await User.findOne({
    firstName: ctx.session.registrationData.firstName,
    lastName: ctx.session.registrationData.lastName,
  });

  if (user) {
    ctx.reply('❗ Пользователь с таким ФИ уже существует.');
    return await handleRestart(ctx);
  }

  ctx.scene.enter('ageScene');
});
lastNameScene.on('message', (ctx) =>
  ctx.reply('❗ Пожалуйста, введите текст.', restartButton)
);
lastNameScene.action('restart_registration', handleRestart);

// Сцена: ввод возраста
const ageScene = new Scenes.BaseScene('ageScene');
ageScene.enter((ctx) =>
  ctx.reply('📅 Сколько вам лет? Введите только число:', restartButton)
);
ageScene.on('text', (ctx) => {
  const age = parseInt(ctx.message.text, 10);

  if (isNaN(age) || age <= 0) {
    return ctx.reply(
      '❗ Пожалуйста, введите корректный возраст (число).',
      restartButton
    );
  }

  if (age > 21) {
    return ctx.reply(
      '🚫 Простите, но вам нельзя участвовать. 😢',
      restartButton
    );
  }

  ctx.session.registrationData.age = age;
  ctx.scene.enter('genderScene');
});
ageScene.on('message', (ctx) =>
  ctx.reply('❗ Пожалуйста, введите текст.', restartButton)
);
ageScene.action('restart_registration', handleRestart);

// Сцена: выбор пола
const genderScene = new Scenes.BaseScene('genderScene');
genderScene.enter(async (ctx) => {
  const guessedGender = guessGender(
    ctx.session.registrationData.firstName,
    ctx.session.registrationData.lastName
  );

  await ctx.reply(
    `⚧ Выберите ваш пол: 
💡 Кажется, вы ${guessedGender} пол.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🙎‍♂️ Мужской', 'gender_male'),
        Markup.button.callback('🙎‍♀️ Женский', 'gender_female'),
      ],
      [Markup.button.callback('🔄 Начать заново', 'restart_registration')],
    ])
  );
});
genderScene.action(['gender_male', 'gender_female'], (ctx) => {
  ctx.session.registrationData.gender =
    ctx.callbackQuery.data === 'gender_male' ? 'male' : 'female';
  ctx.scene.enter('courseScene');
});
genderScene.action('restart_registration', handleRestart);

// Сцена: выбор курса
const courseScene = new Scenes.BaseScene('courseScene');
courseScene.enter(async (ctx) => {
  const guessedCourse = guessAge(ctx.session.registrationData.age);

  await ctx.reply(
    `🎓 Выберите ваш курс:
💡 Кажется, вы ${guessedCourse} курс.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('1️⃣ 1 курс', 'course_1'),
        Markup.button.callback('2️⃣ 2 курс', 'course_2'),
      ],
      [
        Markup.button.callback('3️⃣ 3 курс', 'course_3'),
        Markup.button.callback('4️⃣ 4 курс', 'course_4'),
      ],
      [Markup.button.callback('🔄 Начать заново', 'restart_registration')],
    ])
  );
});
courseScene.action(/^course_(\d)$/, async (ctx) => {
  const course = parseInt(ctx.callbackQuery.data.split('_')[1], 10);
  ctx.session.registrationData.course = course;

  const { firstName, lastName, age, gender } = ctx.session.registrationData;
  const newUser = new User({
    tgId: ctx.from.id,
    firstName,
    lastName,
    age,
    gender,
    course,
  });

  const ref = ctx.session.ref;

  if (ref) {
    const usr = await User.findOne({ _id: ref });
    if (usr) {
      await User.findOneAndUpdate(
        { _id: usr._id },
        { $push: { joins: newUser._id } },
        { new: true }
      );
      await ctx.telegram.sendMessage(
        usr.tgId,
        `👤 <a href="tg://user?id=${ctx.from.id}">${lastName} ${firstName}</a> - зарегистрировался новый пользователь с помощью вашей ссылки.`,
        {
          parse_mode: 'HTML',
        }
      );
    }
  }

  await newUser.save();
  ctx.session.user = newUser;
  ctx.session.registrationData = null;

  await ctx.reply(
    '✅ Регистрация завершена! 🎉 Добро пожаловать!',
    restartButton
  );
  ctx.scene.enter('menuScene');
});
courseScene.action('restart_registration', handleRestart);

module.exports = [nameScene, lastNameScene, ageScene, genderScene, courseScene];