const express = require('express')
const ip = require('ip')
const ipRegex = require('ip-regex')

const ipController = require('../controllers/ip.controller')
const geoIpStore = require('../store/geoip.store')

const app = express()
module.exports = app

app.use(async (req, res) => {
  try {
    const startTime = Date.now()
    let wantedIp = null
    if (req.query && req.query.ip) wantedIp = req.query.ip
    else if (req.body && req.body.ip) wantedIp = req.body.ip
    else wantedIp = req.ip
    if (!ipRegex.v4({ exact: true }).test(wantedIp)) throw { message: 'invalid ip' }
    if (ip.isPrivate(wantedIp)) throw { message: 'local ip' }
    const result = await geoIpStore.findOne(ipController.toLong(wantedIp))
    res.json({ ip: wantedIp, countryCode: result.countryCode, country: result.country })
    console.log('reply sent in', Date.now() - startTime, 'ms')
  } catch (err) {
    if (err.message) {
      console.log('request error:', err.message)
      res.status(401).json({ error: err.message })
    } else {
      console.error('internal error:', err)
      return res.status(500).json({ error: 'internal server error' })
    }
  }
})
