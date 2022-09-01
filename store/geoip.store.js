const fs = require('fs')

const ip = require('../controllers/ip.controller')
const { geoipDataFile, log } = require('../index')
const { csv_refresh_days } = require('../config.json')

const store = {}

module.exports = {
  getMeta: () => store.meta,
  validFor: () => (csv_refresh_days * 24 * 60 * 60 * 1000) - (Date.now() - store.meta.timestamp),
  load,
  findOne
}

function load () {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(geoipDataFile)) throw 'could not find file: ' + geoipDataFile
      const { data, meta } = require(geoipDataFile)
      if (
        typeof data !== 'object' ||
        !Array.isArray(data.v4) || !Array.isArray(data.v6) ||
        ( data.v4.length <= 0 || data.v6.length <= 0 )
      ) throw 'failed to load store!'
      const keys = Object.keys(data)
      const promises = []
      for (let k = 0; k < keys.length; k++) {
        if (Array.isArray(data[keys[k]])) for (let i = 0; i < data[keys[k]].length; i++) promises.push(new Promise(resolve => {
          data[keys[k]][i].from = BigInt(data[keys[k]][i].from)
          data[keys[k]][i].to = BigInt(data[keys[k]][i].to)
          resolve()
        }))
      }
      await Promise.all(promises)
      Object.entries(data).map(([key, entry]) => store[key] = entry)
      store.meta = meta
      return resolve(meta)
    } catch (err) {
      return reject(err)
    }
  })
}

function findOne ({ ip: wantedIp, version }) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof wantedIp !== 'bigint' || typeof version !== 'number') throw 'invalid input'
      let tempList = store[`v${version}`]
      let iterations = 0
      while (tempList.length > 1) try {
        const half = Math.ceil(tempList.length / 2)
        const firstHalf = tempList.slice(0, half)
        const secondHalf = tempList.slice(half)
        const lastItem = firstHalf[firstHalf.length - 1]
        const firstItem = secondHalf[0]
        if (
          typeof firstItem.from !== 'bigint' || typeof firstItem.to !== 'bigint' ||
          typeof lastItem.from !== 'bigint' || typeof lastItem.to !== 'bigint'
        ) throw 'invalid entry in database'
        if (firstItem.from <= wantedIp && firstItem.to >= wantedIp) tempList = [ firstItem ]
        else if (lastItem.from <= wantedIp && lastItem.to >= wantedIp) tempList = [ lastItem ]
        else if (lastItem.to >= wantedIp) tempList = firstHalf
        else if (firstItem.from <= wantedIp) tempList = secondHalf
        else throw 'sorting failed'
      } catch (err) {
        throw err
      } finally {
        iterations++
        if (iterations > 100) tempList = [ { error: 'too many iterations' } ]
      }
      if (tempList[0].from > wantedIp || tempList[0].to < wantedIp) throw { wanted: wantedIp, result: tempList[0] }
      log.debug(`result in ${iterations} iterations:`, tempList[0])
      if (tempList.length !== 1) return reject('something went wrong')
      return resolve(tempList[0])
    } catch (err) {
      return reject(err)
    } 
  })
}
