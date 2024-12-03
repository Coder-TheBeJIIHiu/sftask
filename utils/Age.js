function determineCourseByAge(age) {
  if (age >= 14 && age <= 16) {
    return 1; // 1 курс
  } else if (age === 16 || age === 17) {
    return 2; // 2 курс
  } else if (age === 18 || age === 19) {
    return 3; // 3 курс
  } else if (age === 20 || age === 21) {
    return 4; // 4 курс
  } else {
    return null; // Не студент бакалавриата
  }
}

module.exports = determineCourseByAge;