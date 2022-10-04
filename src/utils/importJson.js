const fs = require('fs')
const path = require('path')

const log = require('./log')

module.exports = (metaFile, dataFolder) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(metaFile)) throw 'could not find file: ' + metaFile

      const metaData = require(metaFile)

      if (
        typeof metaData !== 'object' ||
        typeof metaData.timestamp !== 'number' ||
        typeof metaData.items !== 'object' ||
        Object.keys(metaData.items).length <= 0
      ) throw 'invalid json database! ' + metaFile

      const compiled = {
        meta: metaData,
        data: {
          linked: {}
        }
      }

      const keys = Object.keys(metaData.items)
      const promises = []

      for (const key of keys) promises.push(new Promise((res, rej) => { 
        try {
          const isLinked = !['v4', 'v6'].includes(key)
          
          const filePath = isLinked
          ? path.join(dataFolder, `/linked/${key}.json`)
          : path.join(dataFolder, `/${key}.json`)
          
          if (!fs.existsSync(filePath)) throw `failed to find file: ${filePath}`
          const fileData = require(filePath)
          
          if (isLinked) {
            if (
              typeof fileData !== 'object' ||
              Object.keys(fileData).length <= 0
            ) throw `invalid database ${key}`

            compiled.data.linked[key] = fileData

          } else {
            if (
              !Array.isArray(fileData) ||
              fileData.length <= 0
            ) throw `invalid database ${key}`
            
            for (let i = 0; i < fileData.length; i++) {
              if (
                typeof fileData[i].from === 'string' && 
                typeof fileData[i].to === 'string' 
              ) {
                fileData[i].from = BigInt(fileData[i].from)
                fileData[i].to = BigInt(fileData[i].to)
              }
            }

            compiled.data[key] = fileData
          }

          return res()
        } catch (err) {
          return rej(err)
        }
      }))

      await Promise.all(promises)

      return resolve(compiled)
    } catch(err) {
      return reject(typeof err === 'string' ? `[importJSON] ${err}` : err)
    }
  })
}
