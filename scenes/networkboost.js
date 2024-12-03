const { Markup, Scenes } = require('telegraf');

const NBScene = new Scenes.BaseScene('NBScene');

NBScene.enter(async (ctx) => {
  const htmlMessage = `
  <b>🔥 NETWORK BOOST 🔥</b>

Это <i>особая фишка</i> нашего бота, которая добавляет драйва и интриги! 😎
Каждые <b>2 часа</b> 🕑 выбирается <b>абсолютно случайный человек</b>. Те, кто успеет найти его и ввести специальный код, получают <b>x2 EXP</b>! 🎯💪

Но это ещё не всё...
Ты можешь <b>выкупить NETWORK BOOST</b>, чтобы твоё имя оказалось здесь и ты стал звездой! 🌟 Но учти — это доступно <b>только за крупную сумму! 💰</b>

🎯 Твоя цель: Найти <b>ФИ (Заглушка)</b>
⏳ Время до конца буста: 51 минута (заглушка)
    `;

  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.callback('🔑 Ввести код', 'code'),
      Markup.button.callback('💰 Купить NETWORK BOOST', 'buy_boost'),
    ]
  ])
    await ctx.replyWithHTML(htmlMessage);
})

module.exports = NBScene;