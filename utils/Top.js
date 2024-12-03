const User = require('../models/User');

// Функция получения топ-10
async function getTop10WithExp(userId) {
  try {
    // Запрос на топ-10 пользователей и данные текущего пользователя
    const [topUsers, user] = await Promise.all([
      User.find().sort({ exp: -1 }).limit(10), // Топ-10 пользователей по опыту
      User.findById(userId) // Поиск пользователя по ID
    ]);

    // Если пользователь не найден
    if (!user) {
      return { topUsers, userRank: null, userExp: null };
    }

    // Определение места пользователя с использованием агрегации
    const rank = await User.aggregate([
      { $match: { exp: { $gt: user.exp } } }, // Находим пользователей с большим опытом
      { $count: 'higherExpCount' } // Считаем их количество
    ]);

    // Возвращаем результаты: топ-10, место пользователя и его опыт
    return {
      topUsers,
      userRank: rank.length > 0 ? rank[0].higherExpCount + 1 : 1,
      userExp: user.exp
    };
  } catch (error) {
    console.error('Ошибка при получении данных:', error);
    throw new Error('Не удалось получить данные топа пользователей');
  }
}

module.exports = getTop10WithExp;