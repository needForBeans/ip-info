const http = require('http')
const url = require('url');
const fs = require('fs')
const path = require('path')

"use strict";

const dataFolder = path.join(__dirname + '/../data')
const tempFolder = path.join(dataFolder + '/temp')
const tempFilename = path.join(tempFolder + '/geoip.csv')
const geoipDataFile = path.join(dataFolder + '/geoip.json')

const logPhrase = (type) => `[${type}][${new Date(Date.now()).toLocaleString()}]`
const log = {
  info: (message, content) => console.info(`${logPhrase('INFO')} ${message}`, content? '\n' : '', content || ''),
  debug: (message, content) => console.debug(`${logPhrase('DEBUG')} ${message}`, content? '\n' : '', content || ''),
  error: (message, content) => console.error(`${logPhrase('ERROR')} ${message}`, content? '\n' : '', content || ''),
  //debug: function () {}, // disable debug logging
}

module.exports = {
  tempFolder,
  dataFolder,
  tempFilename,
  geoipDataFile,
  log
}

const ip = require('./ip')
const downloadController = require('./download')
const geoIpStore = require('./store');
const config = require('../config.json')

if (
  typeof config.port !== 'number' ||
  typeof config.csv_src !== 'string' ||
  typeof config.csv_refresh_days !== 'number' || config.csv_refresh_days <= 0
  ) throw new Error('invalid config in config.json')
config.reloadIntervall = (config.csv_refresh_days * 24 * 60 * 60 * 1000)

if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder)
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder)

function getPostData (req) {
  return new Promise(resolve => {
    if (req.headers['content-type'] !== 'application/json') throw { message: 'invalid content-type' }
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      if (body.length > 0) return resolve(JSON.parse(body).ip)
      resolve(false)
    })
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const startTime = Date.now()
    const query = url.parse(req.url, true).query
    
    let wantedIp = req.method === 'POST' ? await getPostData(req) || req.socket.remoteAddress : query.ip || req.socket.remoteAddress
    
    let version = ip.v4regex(wantedIp, { exact: true }) ? 4 : ip.v4asv6regex(wantedIp, { exact: true }) ?
      await new Promise(resolve => { wantedIp = wantedIp.split(':')[3]; resolve(4) }) : ip.v6regex(wantedIp, { exact: true }) ? 6 : false
    
    if (typeof version !== 'number') throw { message: 'invalid ip' }
    if (version === 4 && ip.isPrivateV4(wantedIp)) throw { message: 'private ip' }
    // TODO: add v6 global scope check

    res.on('finish', () => log.info(`[${req.socket.remoteAddress}] ${wantedIp} => ${Date.now() - startTime}ms`)) //logger
    
    const parsed = ip.parse({ ip: wantedIp, version })
    const result = await geoIpStore.findOne({ ip: parsed.number, version })
    const response = JSON.stringify({ ip: wantedIp, countryCode: result.countryCode, country: result.country })
    
    res.writeHead(200, {'content-type': 'application/json', 'accept': 'application/json'})
    res.end(response)
  } catch (err) {
    if (err.message) {
      log.info(`[${req.socket.remoteAddress}] request error:`, err)
      res.writeHead(401, {'content-type': 'application/json', 'accept': 'application/json'})
      res.end(JSON.stringify({ error: err.message }))
    } else {
      log.error(`[${req.socket.remoteAddress}] internal error:`, err)
      res.writeHead(500, {'content-type': 'application/json', 'accept': 'application/json'})
      res.end(JSON.stringify({ error: 'internal server error' }))
    }
  }
})

function reloadDatabase () {
  return new Promise(async (resolve, reject) => {
    try {
      await downloadController.downloadDatabase()
      await downloadController.formatDatabase()
      await geoIpStore.load()
      return resolve()
    } catch (err) {
      return reject(err)      
    }
  })
}

const oneHour = 60 * 60 * 1000
let reloadIntervall = null
let reloadTimeout = null

const setReloadIntervall = () => reloadIntervall = setInterval(() => {
  reloadDatabase
    .then(() => log.info('successfully reloaded database'))
    .catch(err => {
      log.error('failed to reload database', err)
      setTimeout(() => {
        reloadDatabase
          .then(() => log.info('successfully reloaded database'))
          .catch(err => log.error('failed to reload database (2)', err))
      }, oneHour)
    })
}, config.reloadIntervall)

async function start () {
  try {
    if (!fs.existsSync(geoipDataFile)) {
      await reloadDatabase()
      setReloadIntervall()
    } else {
      const meta = await geoIpStore.load()
      const validFor = geoIpStore.validFor()
      log.debug('loaded geoip database from file', meta)
      reloadTimeout = setTimeout(async () => {
        await reloadDatabase()
        setReloadIntervall()
      }, typeof validFor !== 'number' || validFor < oneHour ? 1 : validFor)
    }
    log.info(`database is vald for ${parseFloat(geoIpStore.validFor() / 1000 / 60 / 60 / 24).toFixed(2)} day(s)`)
    server.listen(config.port, (err) => {
      if (err) throw err
      log.info(`server started on port ${config.port}`)
    })
  } catch (err) {
    log.error('GEOIP FAIL AT STARTUP', err)
  }
}

start()


