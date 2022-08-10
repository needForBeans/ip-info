const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const inly = require('inly') // unzip
const ipRegex = require('ip-regex')

const ipController = require('./ip.controller')

module.exports = {
  downloadDatabase,
  extractDatabase,
  formatDatabase
}

function downloadDatabase (tempFilename) {
  return new Promise(async (resolve, reject) => {
    try {
      if (fs.existsSync(tempFilename)) fs.unlinkSync(tempFilename)
      const fileStream = fs.createWriteStream(tempFilename)
      if (!process.env.GEOIP_CSV_SRC || typeof process.env.GEOIP_CSV_SRC !== 'string') throw 'invalid or missing csv source'
      console.log('downloading database from', process.env.GEOIP_CSV_SRC, 'to', tempFilename)
      const res = await fetch(process.env.GEOIP_CSV_SRC)
      await new Promise((resolve, reject) => {
        res.body.pipe(fileStream)
        res.body.on('error', reject)
        res.body.on('finish', resolve)
      })
      console.log('successfully downloaded database')
      return resolve()
    } catch (err) {
      console.log('failed to download database', err)
      return reject(err)
    }
  })
}

function extractDatabase (tempFilename, tempFolder) {
  return new Promise((resolve, reject) => {
    try {
      let fileName
      console.log('unzipping donwloaded file')
      const extract = inly(tempFilename, tempFolder)
      extract.on('file', name => fileName = name )
      extract.on('error', err => { throw err })
      extract.on('end', () => {
        fs.unlinkSync(tempFilename)
        resolve(path.join(tempFolder, '/', fileName))
      })
    } catch (err) {
      return reject(err)
    }
  })
}

function formatDatabase (filename, outFilename) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(filename)) throw 'could not find file: ' + filename
      const formattedContent = []
      const content = fs.readFileSync(filename).toString().split('\n')      
      const promies = []
      const minPossibleLong = ipController.toLong('1.0.0.0')
      const maxPossibleLong = ipController.toLong('255.255.255.255')
      for (let i = 0; i < content.length; i++) promies.push(new Promise((resolve, reject) => {
        let debugLine = null
        try {
          const splitLine = content[i].split(',')
          debugLine = splitLine
          if (splitLine.length < 6) throw 'failed to parse csv'
          for (let i = 0; i < splitLine.length; i++) splitLine[i] = splitLine[i].replace(/['"]+/g, '')
          if (!ipRegex.v4({ exact: true }).test(splitLine[0]) || !ipRegex.v4({ exact: true }).test(splitLine[1])) return resolve() // filter out ipv6 and invalid lines
          const fromLong = ipController.toLong(splitLine[0])
          const toLong = ipController.toLong(splitLine[1])
          if (fromLong < minPossibleLong || fromLong > maxPossibleLong || toLong < minPossibleLong || toLong > maxPossibleLong) throw `impossible long result: ${fromLong} => ${toLong}`
          const info = {
            from: fromLong,
            to: toLong,
            countryCode: splitLine[4],
            country: splitLine[5]
          }
          if (splitLine.length > 6) info.country2 = splitLine[6]
          return resolve(info)
        } catch (err) {
          return reject({ err, debugLine })
        }
      }))
      await Promise.all(promies.map(p => p
        .then(res => {
          if (typeof res === 'object' && typeof res.countryCode === 'string' && typeof res.country === 'string' && typeof res.from === 'number' && typeof res.to === 'number') formattedContent.push(res)
        })
        .catch(err => console.log('failed to format line:', err))
      ))
      console.log('done', { total_entries: formattedContent.length })
      fs.writeFileSync(outFilename, JSON.stringify({ meta: { timestamp: Date.now(), items: formattedContent.length }, data: formattedContent}))
      fs.unlinkSync(filename)
      return resolve()
    } catch (err) {
      return reject(err)
    }
  })
}
