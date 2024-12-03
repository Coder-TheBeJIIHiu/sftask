function guessKazakhGender(firstName, lastName) {
  const maleNameEndings = ['н', 'р', 'с', 'к', 'т', 'м', 'л', 'г', 'б'];
  const femaleNameEndings = ['а', 'е', 'я', 'у', 'и'];
  const maleLastNameEndings = ['ов', 'ев', 'ин', 'улы', 'ли', 'тай', 'ұлы'];
  const femaleLastNameEndings = ['ова', 'ева', 'ина', 'кызы', 'қызы'];

  const normalize = (text) => text.toLowerCase().trim();

  firstName = normalize(firstName);
  lastName = normalize(lastName);

  let gender = 'мужской';

  // Проверяем имя
  if (femaleNameEndings.some((ending) => firstName.endsWith(ending))) {
    gender = 'женский';
  } else if (maleNameEndings.some((ending) => firstName.endsWith(ending))) {
    gender = 'мужской';
  }

  // Проверяем фамилию (имеет приоритет над именем)
  if (femaleLastNameEndings.some((ending) => lastName.endsWith(ending))) {
    gender = 'женский';
  } else if (maleLastNameEndings.some((ending) => lastName.endsWith(ending))) {
    gender = 'мужской';
  }

  return gender;
}

module.exports = guessKazakhGender;