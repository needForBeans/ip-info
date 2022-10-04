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
        //typeof dataFolder !== 'string' ||
        typeof formatFunction !== 'function'
      ) throw 'invalid function input'
      
      if (!fs.existsSync(inFile)) throw `could not find file: ${inFile}` 
      //if (!fs.existsSync(dataFolder)) throw `could not find data folder: ${dataFolder}`
      config = typeof config === 'object' ? config : {}

      
      const formatted = { linked: {} } // save data so you dont need to import it after
      const writeStreams = { linked: {} } // save to files

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

          if (['network', 'geoname_id'].includes(csvItems[0])) return // filter out maxmind csv header
          
          const result = await formatFunction(csvItems)

          if (
            typeof result.item !== 'object' ||
            (typeof result.version !== 'undefined' && typeof result.version !== 'number') || 
            (typeof result.link !== 'undefined' && typeof result.link !== 'object')
          ) throw 'invalid format'

          // only save item when version is set 
          // (used for datasets with only linked data, keep in mind to set the item link either way to prevent errors)
          if (typeof result.version === 'number') { 

            /* if (typeof writeStreams[`v${result.version}`] !== 'object') {
              const wsFile = path.join(dataFolder, `/v${result.version}.json`)
              if (fs.existsSync(wsFile)) throw { message: `cant write to existing database: ${wsFile}`, critical: true } 

              writeStreams[`v${result.version}`] = {
                fd: fs.openSync(wsFile, 'w'),
                useComma: false
              }
              
              fs.writeSync(writeStreams[`v${result.version}`].fd, '[')
            }
            
            if (writeStreams[`v${result.version}`].useComma === true) {
              fs.writeSync(writeStreams[`v${result.version}`].fd, `,\n  ${JSON.stringify(result.item)}`)
            } else {
              writeStreams[`v${result.version}`].useComma = true 
              fs.writeSync(writeStreams[`v${result.version}`].fd, `\n  ${JSON.stringify(result.item)}`)
            } */

            if (!Array.isArray(formatted[`v${result.version}`])) formatted[`v${result.version}`] = []
            formatted[`v${result.version}`].push(result.item)

          }

          // creates linked list to save space
          // only works with consistent information like provider info
          if (typeof result.link === 'object' && Object.keys(result.link).length > 0) for (const [key, entry] of Object.entries(result.link)) {
            if (typeof result.item[key] === 'undefined') throw `cannot link ${key} to undefined`

            if (typeof formatted.linked[key] !== 'object') formatted.linked[key] = {}
            
            if (typeof formatted.linked[key][result.item[key]] === 'undefined') {

              /* const linkedPath = path.join(dataFolder, '/linked')
              
              if (!fs.existsSync(linkedPath)) fs.mkdirSync(linkedPath)
              
              if (typeof writeStreams.linked[key] !== 'object') {
                const wsFile = path.join(linkedPath, `/${key}.json`)

                writeStreams.linked[key] = {
                  fd: fs.openSync(wsFile, 'w'),
                  useComma: false 
                }
                
                fs.writeSync(writeStreams.linked[key].fd, '{')
              } 

              if (writeStreams.linked[key].useComma === true) {
                fs.writeSync(writeStreams.linked[key].fd, `,\n  "${result.item[key]}": ${JSON.stringify(entry)}`)
              } else {
                fs.writeSync(writeStreams.linked[key].fd, `\n  "${result.item[key]}": ${JSON.stringify(entry)}`)
                writeStreams.linked[key].useComma = true
              } */
              
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
      if (Object.keys(writeStreams.linked).length <= 0) delete writeStreams.linked  

      /* save data to files */
      /* for (const [key, entry] of Object.entries(formatted)) {
        if (key === 'linked') {
          if (typeof entry !== 'object') throw new Error('expected object data')

          for (const [lKey, lEntry] of Object.entries(entry)) {
            if (typeof lEntry !== 'object') throw new Error('expected object data')

            const formatedPath = path.join(dataFolder, '/formatted')
            const filePath = path.join(formatedPath, `/${lKey}.json`)

            if (!fs.existsSync()) fs.mkdirSync(formatedPath)

            const fd = fs.openSync(filePath)
            fs.writeSync(fd, '{')
            let useComma = false

            for (const [k, i] of Object.entries(lEntry)) {
              if (useComma === true) fs.writeSync(fd, `,\n  "${k}": ${i}`)
              else {
                fs.writeSync(fd, `\n  "${k}": ${i}`)
                useComma = true
              }
            }

            fs.writeSync(fd, '\n}')
            fs.closeSync(fd)
          }

        } else {
          if (!Array.isArray(entry)) throw new Error('expected array data')

          const fd = fs.openSync(path.join(dataFolder, `/${key}.json`), 'w')
          fs.writeSync(fd, '[')
          let useComma = false

          for (const item of entry) {
            if (useComma === true) fs.writeSync(fd, ',\n  ' + JSON.stringify(item))
            else {
              fs.writeSync(fd, '\n  ' + JSON.stringify(item))
              useComma = true
            }
          }

          fs.writeSync(fd, '\n]')
          fs.closeSync(fd)
        }
      }  */

      /* end write streams */
      /* Object.entries(writeStreams).map(([key, entry]) => {
        if (key === 'linked') Object.entries(entry).map(([lKey, lEntry]) => {
          if (typeof lEntry === 'object' && typeof lEntry.fd !== 'undefined') {
            fs.writeSync(lEntry.fd, '\n}')
            fs.closeSync(lEntry.fd)
          }
        })
        else if (typeof entry === 'object' && typeof entry.fd !== 'undefined') {
          fs.writeSync(entry.fd, '\n]')
          fs.closeSync(entry.fd)
        }
        else log.error(`[formatCsv] failed to end writeStream ${key}`)
      }) */

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