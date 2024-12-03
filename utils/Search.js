const mongoose = require('mongoose');

const User = require('../models/User');

/**
 * Получает случайного пользователя, подходящего под критерии.
 * @param {mongoose.Types.ObjectId} userId ID пользователя, которого исключаем из поиска.
 * @param {number} course Номер курса (1–2 или 3–4).
 * @param {string} gender Пол текущего пользователя ("male" или "female").
 * @returns {Promise<object|null>} Случайный пользователь или null, если никого не нашли.
 */
async function getRandomUser(user) {

  const userId = user._id;
  const course = user.course;
  const gender = user.gender;

  
  try {
    // Определяем курсовую группу
    const courseRange = course <= 2 ? [1, 2] : [3, 4];

    // Определяем противоположный пол
    const oppositeGender = gender === "male" ? "female" : "male";

    // Ищем подходящих пользователей
    const users = await User.aggregate([
      {
        $match: {
          _id: { $ne: userId }, // Исключаем текущего пользователя
          "gameList.isActive": false, // Только с неактивными играми
         course: { $in: courseRange }, // Фильтр по курсу
          gender: oppositeGender, // Фильтр по противоположному полу
        },
      },
      { $sample: { size: 1 } }, // Берем одного случайного
    ]);

    console.log(users);

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Ошибка при поиске пользователя:', error);
    return null;
  }
}

module.exports = getRandomUser;