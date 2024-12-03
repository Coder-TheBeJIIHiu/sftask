const axios = require('axios')

class GitHubFileFetcher {
  constructor(cacheDuration = 15 * 60 * 1000) {
    this.cacheDuration = cacheDuration
    this.cache = {} // Кэш для разных файлов
  }

  async fetchFile(url) {
    const currentTime = Date.now()

    // Если файл уже в кэше и не истекло время хранения
    if (this.cache[url] && (currentTime - this.cache[url].lastFetched < this.cacheDuration)) {
      console.log(`Используется кэшированный файл для: ${url}`)
      return this.cache[url].data
    }

    try {
      console.log(`Загружается новый файл с GitHub: ${url}`)
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/vnd.github.v3.raw'
        }
      })

      // Сохраняем файл в кэш и обновляем время последнего скачивания
      this.cache[url] = {
        data: response.data,
        lastFetched: currentTime
      }

      return response.data
    } catch (error) {
      console.error('Ошибка при получении файла:', error)
      return null
    }
  }
}

// Экспортируем класс, чтобы использовать его в других файлах
module.exports = GitHubFileFetcher