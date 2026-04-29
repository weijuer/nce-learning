import NCE_JSON_SOURCE from '/nce.json?url&raw'

interface NCELesson {
  name: string
  fileName: string
}

interface NCEData {
  [key: string]: NCELesson[]
}

export const generateNCEJson = (): NCEData => {
  const nceData: NCEData = {}

  // 读取NCE数据并返回json格式
  const modules = import.meta.glob(['/data/**/*.mp3', '/data/**/*.lrc'], {
    import: 'default',
    eager: true,
    query: '?url'
  })

  for (const path in modules) {
    if (path.endsWith('.mp3')) {
      // 解析路径，获取文件夹名和文件名
      const pathParts = path.split('/')
      const folderName = pathParts[pathParts.length - 2] // 获取文件夹名，如 NCE1, NCE2
      const fileName = pathParts[pathParts.length - 1].replace('.mp3', '')

      // 提取课程名称（去掉编号部分）
      const lessonName = fileName.replace(/^\d+&?\d*－/, '')

      // 初始化文件夹数据
      if (!nceData[folderName]) {
        nceData[folderName] = []
      }

      // 添加到对应的文件夹数组中
      nceData[folderName].push({
        name: lessonName,
        fileName: fileName
      })
    }
  }

  // 对每个文件夹的课程按文件名排序
  for (const folder in nceData) {
    nceData[folder].sort((a, b) => {
      // 提取文件名中的数字进行排序
      const getNumber = (fileName: string) => {
        const match = fileName.match(/^(\d+)/)
        return match ? parseInt(match[1]) : 0
      }
      return getNumber(a.fileName) - getNumber(b.fileName)
    })
  }

  return nceData
}

export const NCE_JSON = JSON.parse(NCE_JSON_SOURCE as unknown as string)
