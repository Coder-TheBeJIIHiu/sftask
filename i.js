// Импортируем класс GitHubFileFetcher
const GitHubFileFetcher = require('./utils/GitHubFileFetcher')

// Создаем экземпляр класса
const fetcher = new GitHubFileFetcher()

async function getData(url) {
  const data = await fetcher.fetchFile(url)
  if (data) {
    console.log(data)
  }
}

// Пример с несколькими файлами
const url1 = 'https://raw.githubusercontent.com/Coder-TheBeJIIHiu/SFEK-TASK/refs/heads/main/howtoplay.txt'

getData(url1)

// Пример вызова через 10 секунд
setTimeout(() => getData(url1), 10000)