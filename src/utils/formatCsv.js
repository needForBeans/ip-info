const fs = require('fs')
const readline = require('readline')
const events = require('events')
const path = require('path')

const log = require('./log')

module.exports = (inFile, dataFolder, formatFunction, config) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (
        typeof inFile !== 'string' ||
        typeof formatFunction !== 'function'
      ) throw 'invalid function input'
      
      if (!fs.existsSync(inFile)) throw `could not find file: ${inFile}` 
      config = typeof config === 'object' ? config : {}

      const formatted = { linked: {} } 

      const rl = readline.createInterface({
        input: fs.createReadStream(inFile)
      })

      const meta = { 
        timestamp: Date.now(),
        items: {}
      }

      rl.on('line', async line => {
        try {
          const csvItems = line.split(typeof config.delimiter === 'string' ? config.delimiter : ',')
          for (let i = 0; i < csvItems.length; i++) csvItems[i] = csvItems[i].replace(/['"]+/g, '')

          /* filter out headers */
          if (
            ['network', 'geoname_id'].includes(csvItems[0]) || // maxmind
            (csvItems[0] === '0.0.0.0' && csvItems[1] === '255.255.255.255') // ipdb
          ) return null

          const result = await formatFunction(csvItems)

          if (
            typeof result.item !== 'object' ||
            (typeof result.version !== 'undefined' && typeof result.version !== 'number') || 
            (typeof result.link !== 'undefined' && typeof result.link !== 'object')
          ) throw 'invalid format'

          // only save item when version is set 
          // (used for datasets with only linked data, keep in mind to set the item link either way to prevent errors)
          if (typeof result.version === 'number') { 
            if (!Array.isArray(formatted[`v${result.version}`])) formatted[`v${result.version}`] = []
            formatted[`v${result.version}`].push(result.item)
          }

          // creates linked list to save space
          // only works with consistent information like provider info
          if (typeof result.link === 'object' && Object.keys(result.link).length > 0) for (const [key, entry] of Object.entries(result.link)) {
            if (typeof result.item[key] === 'undefined') throw `cannot link ${key} to undefined`

            if (typeof formatted.linked[key] !== 'object') formatted.linked[key] = {}
            
            if (typeof formatted.linked[key][result.item[key]] === 'undefined') {
              formatted.linked[key][result.item[key]] = entry
            } else if (
              typeof formatted.linked[key][result.item[key]] !== 'object' ||
              typeof entry !== 'object' ||
              Object.keys(formatted.linked[key][result.item[key]]).length !== Object.keys(entry).length ||
              JSON.stringify(formatted.linked[key][result.item[key]]) !== JSON.stringify(entry)
            ) log.warn('linked values should be consistent!', JSON.stringify({ formatted: formatted.linked[key][item[key]], entry }, null, 2))

          }
        } catch (err) {
          log.error('failed to format line: ' + line, err)
        }
      })

      await events.once(rl, 'close')

      if (Object.keys(formatted.linked).length <= 0) delete formatted.linked  

      /* get meta info */
      Object.entries(formatted).map(([key, entry]) => {
        if (Array.isArray(entry)) meta.items[key] = entry.length
        else if (key === 'linked' && typeof entry === 'object') Object.entries(entry).map(([key1, entry1]) => meta.items[key1] = Object.keys(entry1).length)
      })

      if (Object.keys(meta.items).length <= 0) throw 'failed to extract database from csv file'
    
      log.debug(`formatted file to json: ${inFile}`)

      return resolve({ data: formatted, meta })
    } catch (err) {
      return reject(typeof err === 'string' ? `[formatCsv] ${err}` : err)
    }
  })
}
