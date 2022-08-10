const fs = require('fs')

const ipTools = require('../controllers/ip.controller')
const { geoipDataFile } = require('../index')

const store = {}

module.exports = {
  getMeta: () => { return store.meta },
  load,
  findOne
}

function load () {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(geoipDataFile)) throw 'could not find file: ' + geoipDataFile
      const { data, meta } = require(geoipDataFile)
      store.geoip = data
      store.meta = meta
      if (!Array.isArray(store.geoip) || !store.geoip.length || store.geoip.length <= 0) throw 'no valid entries in store!'
      return resolve(meta)
    } catch (err) {
      return reject(err)
    }
  })
}

function findOne (wantedIp) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof wantedIp !== 'number') throw 'invalid input'
      console.log({ wantedIp , original: ipTools.fromLong(wantedIp) })
      let tempList = store.geoip
      let iterations = 0
      while (tempList.length > 1) try {
        const half = Math.ceil(tempList.length / 2)
        const firstHalf = tempList.slice(0, half)
        const secondHalf = tempList.slice(half)
        const lastItem = firstHalf[firstHalf.length - 1]
        const firstItem = secondHalf[0]
        if (typeof firstItem.from !== 'number' || typeof firstItem.to !== 'number') throw 'invalid entry'
        if (typeof lastItem.from !== 'number' || typeof lastItem.to !== 'number') throw 'invalid entry'
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
      console.log(tempList[0], { iterations })
      if (tempList.length !== 1) return reject('something went wrong')
      return resolve(tempList[0])
    } catch (err) {
      return reject(err)
    } 
  })
}
