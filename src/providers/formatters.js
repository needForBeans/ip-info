const ip = require('../utils/ip')
const countryCodes = require('../utils/countryCodes.json')

const mailfudFormatter = csvItems => {
  return new Promise((resolve, reject) => {
    try {
      if (csvItems.length < 6) throw 'not enough csv items'
      
      const version = ip.getVersion(csvItems[0])
      if (![4, 6].includes(version) || version !== ip.getVersion(csvItems[1])) throw 'invalid ip version'

      const item = {
        from: ip.parse({ ip: csvItems[0], version }).number.toString(),
        to: ip.parse({ ip: csvItems[1], version }).number.toString(),
        countryCode: csvItems[4]
      }

      const invalidItems = Object.entries(item)
        .map(([key, entry]) => {
          if (key === 'countryCode' && !countryCodes.includes(entry)) {
            delete item.countryCode
            return null
          }
          if (typeof entry === 'string') return null
          return { key, entry, type: { got: typeof entry, expected: 'string' }}
        })
        .filter(i => i !== null).length > 0

      if (invalidItems.length > 0) throw { err: 'invalid types in item', invalidItems }
      
      return resolve({ item, version })
    } catch (err) {
      return reject(err)
    }
  })
}

const ip2asnFormatter = csvItems => {
  return new Promise((resolve, reject) => {
    try {
      if (csvItems.length < 4) throw `not enough csv items`
      
      const version = ip.getVersion(csvItems[0])
      if (![4, 6].includes(version) || version !== ip.getVersion(csvItems[1])) throw 'invalid ip version'

      const item = {
        from: ip.parse({ ip: csvItems[0], version }).number.toString(),
        to: ip.parse({ ip: csvItems[1], version }).number.toString(),
        asn: parseInt(csvItems[2])
      }

      const link = {
        asn: {
          countryCode: csvItems[3],
          provider: csvItems[4]
        }
      }

      const invalidItems = Object.entries(item)
        .map(([key, entry]) => {
          const expectedType = key === 'asn' ? 'number' : 'string'
          if (typeof entry === expectedType) return null
          return { key, entry, type: { got: typeof entry, expected: expectedType }}
        })
        .concat(
          Object.entries(link.asn).map(([key, entry]) => {
            if (key === 'countryCode' && !countryCodes.includes(entry)) {
              delete link.asn.countryCode
              return null
            }
            if (typeof entry === 'string') return null
            return { key, entry, type: { got: typeof entry, expected: 'string' }}
          })
        )
        .filter(i => i !== null)            

      if (invalidItems.length > 0) throw { err: 'invalid types in item', invalidItems }
      
      return resolve({ item, version, link })
    } catch (err) {
      return reject(err)
    }
  })
}

const maxmindAsnFormatter = (csvItems, version) => {
  return new Promise((resolve, reject) => {
    try {
      if (csvItems.length < 3) throw `not enough csv items`

      const [ipFrom, ipTo] = ip.cidrToRange({ cidr: csvItems[0], version })

      if (version !== ip.getVersion(ipFrom) || version !== ip.getVersion(ipTo)) throw 'invalid ip version'

      const item = {
        from: ip.parse({ ip: ipFrom, version }).number.toString(),
        to: ip.parse({ ip: ipTo, version }).number.toString(),
        asn: parseInt(csvItems[1])
      }

      const link = {
        asn: {
          provider: csvItems[2]
        }
      }

      const invalidItems = Object.entries(item)
        .map(([key, entry]) => {
          const expectedType = key === 'asn' ? 'number' : 'string'
          if (typeof entry === expectedType) return null
          return { key, entry, type: { got: typeof entry, expected: expectedType }}
        })
        .concat(
          Object.entries(link.asn).map(([key, entry]) => {
            if (typeof entry === 'string') return null
            return { key, entry, type: { got: typeof entry, expected: 'string' }}
          })
        )
        .filter(i => i !== null)            

      if (invalidItems.length > 0) throw { err: 'invalid types in item', invalidItems }
      
      return resolve({ item, version, link })
    } catch (err) {
      return reject(err)
    }
  })
}

const maxmindCityFormatter = (csvItems, version) => {
  return new Promise((resolve, reject) => {
    try {
      if (csvItems.length < 10) throw `not enough csv items`

      const [ipFrom, ipTo] = ip.cidrToRange({ cidr: csvItems[0], version })

      if (version !== ip.getVersion(ipFrom) || version !== ip.getVersion(ipTo)) throw 'invalid ip version'

      const item = {
        from: ip.parse({ ip: ipFrom, version }).number.toString(),
        to: ip.parse({ ip: ipTo, version }).number.toString(),
        geoname_id: typeof csvItems[1] !== 'undefined' && csvItems[1].length > 0 ? parseInt(csvItems[1]) : undefined, // linked with maxmindLocationFormatter!
        anonymousProxy: Boolean(parseInt(csvItems[4])),
        satelliteProvider: Boolean(parseInt(csvItems[5])),
        postalCode: typeof csvItems[6] !== 'undefined' && csvItems[6].length > 0 ? parseInt(csvItems[6]) : undefined,
        accuracyRadius: typeof csvItems[9] !== 'undefined' && csvItems[9].length > 0 ? parseInt(csvItems[9]) : undefined
      }

      const invalidItems = Object.entries(item)
        .map(([key, entry]) => {
          const expectedType = ['geoname_id', 'postalCode', 'accuracyRadius'].includes(key) ? 'number'
            : ['anonymousProxy', 'satelliteProvider'].includes(key) ? 'boolean' : 'string'
          if (typeof entry === expectedType || (!['from', 'to'].includes(key) && typeof entry === 'undefined')) return null
          return { key, entry, type: { got: typeof entry, expected: expectedType }}
        })
        .filter(i => i !== null)

      if (invalidItems.length > 0) throw { err: 'invalid types in item', invalidItems }
      
      return resolve({ item, version })
    } catch (err) {
      return reject(err)
    }
  })
}

const maxmindLocationFormatter = csvItems => {
  return new Promise((resolve, reject) => {
    try {
      if (csvItems.length < 3) throw `not enough csv items`

      const item = { // just to prevent errors. doesnt get stored
        geoname_id: parseInt(csvItems[0])
      }

      const link = {
        geoname_id: {
          continentCode: csvItems[2],
          countryCode: csvItems[4],
          regionCode: csvItems[6],
          regionName: csvItems[7],
          regionCode1: csvItems[8],
          regionName1: csvItems[9],
          cityName: csvItems[10],
        }
      }

      const invalidItems = Object.entries(item)
        .map(([key, entry]) => {
          const expectedType = 'number'
          if (typeof entry === expectedType) return null
          return { key, entry, type: { got: typeof entry, expected: expectedType }}
        })
        .concat(
          Object.entries(link.geoname_id).map(([key, entry]) => {
            if (typeof entry === 'undefined') {
              delete link.geoname_id[key]
              return null
            }
            if (key === 'countryCode' && !countryCodes.includes(entry)) {
              delete link.geoname_id.countryCode
              return null
            }
            if (typeof entry === 'string') {
              if (entry.length <= 0) delete link.geoname_id[key]
              return null
            }
            return { key, entry, type: { got: typeof entry, expected: 'string' }}
          })
        )
        .filter(i => i !== null)            

      if (invalidItems.length > 0) throw { err: 'invalid types in item', invalidItems }
      
      return resolve({ item, link })
    } catch (err) {
      return reject(err)
    }
  })
}

module.exports = {
  mailfudFormatter,
  ip2asnFormatter,
  maxmindAsnFormatter,
  maxmindCityFormatter,
  maxmindLocationFormatter
}
