const path = require('path')

const geoIp = require('../controllers/geoip.controller')
const geoIpStore = require('../store/geoip.store')
const { tempFolder, geoipDataFile } = require('../index')

module.exports = {
  checkOutdated,
  getLatest,
  startUpdateDeamon: (updateCheckIntervall) => setInterval(async () => {
    try {
      const outdated = await checkOutdated()
      if (outdated) {
        console.log('updating outdated database')
        await getLatest()
      }
    } catch (err) {
      console.log('update check failed:', err)
    }
  }, updateCheckIntervall) 
}

function checkOutdated () {
  return new Promise((resolve, reject) => {
    try {
      const meta = geoIpStore.getMeta()
      if (!meta.timestamp || typeof meta.timestamp !== 'number') throw 'invalid meta data in geoip file'
      const fileAge = Date.now() - meta.timestamp
      const maxAge = process.env.GEOIP_SRC_VALID_FOR_DAYS * 24 * 60 * 60 * 1000 
      if (fileAge > maxAge) return resolve(true)
      console.log('Database is valid for', parseFloat((maxAge - fileAge) / 1000 / 60 / 60 / 24).toFixed(2), 'more days')
      return resolve(false)
    } catch (err) {
      return reject(err)
    }
  })
}

function getLatest () {
  return new Promise(async (resolve, reject) => {
    try {
      let fileName
      if (!process.env.GEOIP_SKIP_UNZIP) {
        const tempFilename = path.join(tempFolder, '/geoip.csv.gz') 
        await geoIp.downloadDatabase(tempFilename)
        fileName = await geoIp.extractDatabase(tempFilename, tempFolder)
      } else {
        const tempFilename = path.join(tempFolder, '/geoip.csv') 
        await geoIp.downloadDatabase(tempFilename)
        fileName = tempFilename
      }
      await geoIp.formatDatabase(fileName, geoipDataFile)
      return resolve()
    } catch (err) {
      return reject(err)
    }
  })
}
