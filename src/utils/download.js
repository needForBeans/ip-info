const https = require('https')
const zlib = require('zlib')
const fs = require('fs')

module.exports = (src, outputFile, disableUnzip) => {
  return new Promise((resolve, reject) => {
    try {
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile)
      
      const unzipStream = zlib.createGunzip()
      const writeStream = fs.createWriteStream(outputFile)
      
      writeStream.on('finish', () => writeStream.close())
      writeStream.on('close', () => resolve())
      writeStream.on('error', err => reject(err))
      
      https.get(src, res =>
        disableUnzip === true 
          ? res.pipe(writeStream)
          : res.pipe(unzipStream).pipe(writeStream)
      ).on('error', err => reject(err))
    } catch (err) {
      return reject(err)
    }
  })
}
