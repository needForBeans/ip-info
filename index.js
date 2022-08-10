const http = require('http')
const fs = require('fs')
const path = require('path')

require('dotenv').config()

const tempFolder = path.join(__dirname, '/temp')
const dataFolder = path.join(__dirname, '/data')
const geoipDataFile = path.join(dataFolder, '/geoip.json')
const updateCheckIntervall = (1000 * 60 * 60 * 2) // check every 2 hours

module.exports = {
  tempFolder,
  dataFolder,
  geoipDataFile
}

const app = require('./config/express.config')
const updateController = require('./controllers/update.controller')
const geoIpStore = require('./store/geoip.store')

if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder)
if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder)

async function start () {
  try {
    if (!fs.existsSync(geoipDataFile)) await updateController.getLatest()
    const meta = await geoIpStore.load()
    console.log(`loaded geoip database from file`, meta)
    const outdated = await updateController.checkOutdated()
    if (outdated) await updateController.getLatest()
    updateController.startUpdateDeamon(updateCheckIntervall)
  } catch (err) {
    console.log('GEOIP FAIL AT STARTUP:', err)
  }
}

start()

const server = http.createServer(app)
server.listen(process.env.GEOIP_API_PORT, (err) => {
  if (err) throw err
  console.log('server started on port:', process.env.GEOIP_API_PORT)
})
