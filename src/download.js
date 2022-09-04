const https = require('https')
const zlib = require('zlib')
const fs = require('fs')

const ip = require('./ip')
const config = require('../config.json')
const { log, tempFilename, geoipDataFile } = require('./index')

module.exports = {
  downloadDatabase,
  formatDatabase
}

function downloadDatabase () {
  return new Promise((resolve, reject) => {
    try {
      log.info('starting download:', config.csv_src)
      if (fs.existsSync(tempFilename)) fs.unlinkSync(tempFilename)
      const unzipStream = zlib.createGunzip()
      const writeStream = fs.createWriteStream(tempFilename)
      const startTime = Date.now()
      writeStream.on('finish', () => { 
        writeStream.close()
        log.info(`Download completed in ${Date.now() - startTime}ms`)
        return resolve()
      })
      https.get(config.csv_src, res => res
        .pipe(unzipStream)
        .pipe(writeStream)
      ).on('error', err => reject(err))
    } catch (err) {
      return reject(err)
    }
  })
}

function formatDatabase () {
  return new Promise(async (resolve, reject) => {
    try {
      const startTime = Date.now()
      if (!fs.existsSync(tempFilename)) throw 'could not find file: ' + tempFilename
      log.info('converting csv to json')
      const formattedContent = { v4: [], v6: [] }
      const content = fs.readFileSync(tempFilename).toString().split('\n')      
      const promises = []
      for (let i = 0; i < content.length; i++) promises.push(new Promise((resolve, reject) => {
        let debugLine = null
        try {
          const splitLine = content[i].split(',')
          debugLine = splitLine
          if (splitLine.length < 6) throw 'failed to parse csv'
          for (let i = 0; i < splitLine.length; i++) splitLine[i] = splitLine[i].replace(/['"]+/g, '')
          const version = ip.getVersion(splitLine[0])
          if (!version || version !== ip.getVersion(splitLine[1])) return reject('invalid ip version')
          const info = {
            from: ip.parse({ ip: splitLine[0], version }).number.toString(),
            to: ip.parse({ ip: splitLine[1], version }).number.toString(),
            countryCode: splitLine[4],
            country: splitLine.length > 6 ? `${splitLine[5]} / ${splitLine[6]}` : splitLine[5]
          }
          return resolve({ info, version })
        } catch (err) {
          return reject({ err, debugLine })
        }
      }))
      await Promise.all(promises.map(p => p
        .then(({ info, version }) => {
          const invalidItems = Object.entries(info).map(([key, entry]) => {
            if (typeof entry === 'string') return null
            return { key, entry, type: { got: typeof entry, expected: 'string' }}
          }).filter(i => i !== null)
          if (typeof info === 'object' && invalidItems.length <= 0) {
            if (!Array.isArray(formattedContent[`v${version}`])) formattedContent[`v${version}`] = []
            formattedContent[`v${version}`].push(info)
          } else {
            log.error('got item with invalid format', { 
              response: typeof info,
              invalid: invalidItems
            })
          }
        })
        .catch(err => log.error('failed to format line:', err))
      ))
      //log.debug(formattedContent)
      const meta = { timestamp: Date.now(), items: { v4: formattedContent.v4.length, v6: formattedContent.v6.length }}
      log.info(`converted csv to json in ${Date.now() - startTime}ms`, meta.items)
      if (meta.items.v4 <= 0 && meta.items.v6 <= 0) throw 'failed to extract database from csv file'
      if (fs.existsSync(geoipDataFile)) fs.unlinkSync(geoipDataFile)
      //if (fs.existsSync(tempFilename)) fs.unlinkSync(tempFilename)
      fs.writeFileSync(geoipDataFile, JSON.stringify({ meta, data: formattedContent}, null, 2))
      return resolve()
    } catch (err) {
      return reject(err)
    }
  })
}

