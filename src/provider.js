const path = require('path')
const fs = require('fs')

const { folders } = require('./utils/config')
const formatCsv = require('./utils/formatCsv')
const importJson = require('./utils/importJson')
const log = require('./utils/log')
const download = require('./utils/download')
const StreamZip = require('./utils/node-stream-zip')

/* 
* find one max iterations
* 30 = a list with max 1073741824 items
*/
const maxIterations = 30

module.exports = class {
  constructor ({ name, validFor, src, srcType, asyncLineFormatter, asyncFileFormatters, formatterConfig, disableUnzip  }) {
    this.config = { 
      name,
      validFor,
      src,
      srcType,
      formatter: formatterConfig || {},
      disableUnzip: srcType === 'folder' ? true : disableUnzip || false
    }

    srcType === 'folder'
      ? this.asyncFileFormatters = asyncFileFormatters
      : this.asyncLineFormatter = asyncLineFormatter

    this.folders = {
      data: path.join(folders.data, `/${name}`),
      temp: srcType === 'folder' 
        ? path.join(folders.temp, `/${name}`)
        : undefined
    }

    this.files = {
      meta: path.join(folders.data, `/${name}/meta.json`),
      temp: srcType === 'folder'
        ? path.join(folders.temp, `/${name}.zip`)
        : path.join(folders.temp, `/${name}.${srcType}`)
    }

  }

  databaseExists () {
    return fs.existsSync(this.files.meta)
  }
  
  isLoaded () {
    return typeof this.store == 'object' && typeof this.store.meta === 'object' && typeof this.store.data === 'object' && Object.keys(this.store.data).length > 0
  }

  validFor () {
    return this.store.meta && typeof this.store.meta.timestamp === 'number' ? this.config.validFor - (Date.now() - this.store.meta.timestamp) : false
  }

  load () {
    return new Promise(async (resolve, reject) => {
      try {
        const startTime = Date.now()

        this.store = await importJson(this.files.meta, this.folders.data)
        
        log.info(`[${this.config.name}] loaded database in ${Date.now() - startTime}ms`)
        log.debug(`[${this.config.name}] items:`, JSON.stringify(this.store.meta.items, null, 2))
        
        return resolve()
      } catch (err) {
        return reject(typeof err === 'string' ? `[${this.config.name}] [load] ${err}` : err)
      }
    })
  }

  download () {
    return new Promise(async (resolve, reject) => {
      try {
        const startTime = Date.now()
        if (process.env.NODE_ENV !== 'development' || !fs.existsSync(this.files.temp)) { // DEV: prevent redownload to test formatting
          if (fs.existsSync(this.files.temp)) fs.unlinkSync(this.files.temp)

          log.info(`[${this.config.name}] starting download: ${this.config.src}`)
          await download(this.config.src, this.files.temp, this.config.disableUnzip)
        }
        
        log.debug(`[${this.config.name}] converting download to json`)
        const finalData = {}

        if (fs.existsSync(this.folders.data)) fs.rmdirSync(this.folders.data, { recursive: true }) 
        fs.mkdirSync(this.folders.data)

        if (this.config.srcType !== 'folder') {
          const { data, meta } = await formatCsv(this.files.temp, this.folders.data, this.asyncLineFormatter, this.config.formatter)
          
          finalData.data = data
          finalData.meta = meta

        } else {
          if (fs.existsSync(this.folders.temp)) fs.rmdirSync(this.folders.temp, { recursive: true })
          fs.mkdirSync(this.folders.temp)

          const zip = new StreamZip.async({ file: this.files.temp })

          await zip.extract(null, this.folders.temp);
          await zip.close()

          const filename = fs.readdirSync(this.folders.temp)
          const folderPath = path.join(this.folders.temp, '/', filename[0])

          if (!Array.isArray(filename) || filename.length <= 0) throw 'failed to unzip downloaded data'
          if (filename.length !== 1) throw 'expected one folder got multiple items'
          if (!fs.statSync(folderPath).isDirectory()) throw 'expected folder got something else'

          const filenames = fs.readdirSync(folderPath)
          if (!Array.isArray(filenames) || filenames.length <= 0) throw 'could not find any files in downloaded folder'

          const promises = Object.entries(this.asyncFileFormatters).map(([key, formatter]) => {
            const file = path.join(folderPath, '/', key)
            if (!filenames.includes(key)) throw `could not find file: ${file}`
            return formatCsv(file, this.folders.data, formatter, this.config.formatter)
          })

          const result = await Promise.all(promises)

          const compiled = {
            meta: { items: {} },
            data: { linked: {} }
          }

          result.map(({ data, meta }) => {
            Object.entries(data).map(([key, entry]) => {
              if (key === 'linked') {
                Object.entries(entry).map(([linkKey, linkEntry]) => {
                  if (typeof compiled.data.linked[linkKey] !== 'object') compiled.data.linked[linkKey] = linkEntry
                  else {
                    Object.entries(linkEntry).map(([childKey, childEntry]) => {
                      if (typeof compiled.data.linked[linkKey][childKey] !== 'object') compiled.data.linked[linkKey][childKey] = childEntry 
                      else if (JSON.stringify(compiled.data.linked[linkKey][childKey]) !== JSON.stringify(childEntry)) log.warn('linked values should be consistent!', JSON.stringify([ compiled.data.linked[linkKey][childKey], childEntry ], null, 2))
                    })
                  }
                })

              } else {
                if (typeof compiled.data[key] !== 'undefined') throw `cannot combine data objects ${key}`
                compiled.data[key] = entry
              }
            })

            if (typeof compiled.meta.timestamp !== 'number') compiled.meta.timestamp = meta.timestamp

            Object.entries(meta.items).map(([key, entry]) => {
              if (typeof compiled.meta.items[key] !== 'number') compiled.meta.items[key] = entry
              else compiled.meta.items[key] = compiled.meta.items[key] + entry 
            })
          })

          if (fs.existsSync(this.folders.temp)) fs.rmdirSync(this.folders.temp, { recursive: true })

          finalData.data = compiled.data
          finalData.meta = compiled.meta
        }

        if (typeof finalData.meta !== 'object' || Object.entries(finalData.meta).length <= 0) throw 'failed to get metadata'

        /* save data to files */
        for (const [key, entry] of Object.entries(finalData.data)) {
          if (key === 'linked') {
            if (typeof entry !== 'object') throw new Error('expected object data')
  
            for (const [lKey, lEntry] of Object.entries(entry)) {
              if (typeof lEntry !== 'object') throw new Error('expected object data')
  
              const formatedPath = path.join(this.folders.data, '/linked')
              const filePath = path.join(formatedPath, `/${lKey}.json`)
  
              if (!fs.existsSync()) fs.mkdirSync(formatedPath)
  
              const fd = fs.openSync(filePath, 'w')
              fs.writeSync(fd, '{')
              let useComma = false
  
              for (const [k, i] of Object.entries(lEntry)) {
                if (useComma === true) fs.writeSync(fd, `,\n  "${k}": ${JSON.stringify(i)}`)
                else {
                  fs.writeSync(fd, `\n  "${k}": ${JSON.stringify(i)}`)
                  useComma = true
                }
              }
  
              fs.writeSync(fd, '\n}')
              fs.closeSync(fd)

              log.debug(`[${this.config.name}] saved file: ${filePath}`)
            }
  
          } else {
            if (!Array.isArray(entry)) throw new Error('expected array data')
  
            const filePath = path.join(this.folders.data, `/${key}.json`)

            const fd = fs.openSync(filePath, 'w')
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

            log.debug(`[${this.config.name}] saved file: ${filePath}`)
          }
        } 

        if (fs.existsSync(this.files.meta)) fs.unlinkSync(this.files.meta)
        fs.writeFileSync(this.files.meta, JSON.stringify(finalData.meta, null, 2))

        this.store = finalData

        if (process.env.NODE_ENV !== 'development' && fs.existsSync(this.files.temp)) fs.unlinkSync(this.files.temp) // DEV: prevent deleting temp data

        log.info(`[${this.config.name}] downloaded & converted database in ${Date.now() - startTime}ms`)
        return resolve()
      } catch (err) {
        return reject(typeof err === 'string' ? `[${this.config.name}] [download] ${err}` : err)
      }
    })
  }

  findOne ({ wantedIp, version }) {
    return new Promise((resolve, reject) => {
      try {
        const startTime = Date.now()
        if (
          typeof wantedIp !== 'bigint' ||
          typeof version !== 'number'
        ) throw `invalid input`

        let list = this.store.data[`v${version}`]
        if (!Array.isArray(list) || list.length <= 0) {
          log.debug(`[${this.config.name}] version ${version} not stored`)
          return resolve({})
        }

        let iterations = 0
        while (list.length > 1) {
          const half = Math.ceil(list.length / 2)
          const firstHalf = list.slice(0, half)
          const secondHalf = list.slice(half)
          const lastItem = firstHalf[firstHalf.length - 1]
          const firstItem = secondHalf[0]
          
          if (list[0].from <= wantedIp && list[0].to >= wantedIp) {
            list = [ list[0] ]
          }
          else if (firstItem.from <= wantedIp && firstItem.to >= wantedIp) {
            list = [ firstItem ]
          } 
          else if (lastItem.from <= wantedIp && lastItem.to >= wantedIp) {
            list = [ lastItem ]
          } 
          else if (lastItem.to >= wantedIp) {
            list = firstHalf
          } 
          else if (firstItem.from <= wantedIp) {
            list = secondHalf
          }
          else {
            if (list.length <= 10) list.shift()
            else throw `sorting failed with ${items.length} items left after ${iterations} iterations`
          }
          
          iterations++
          if (iterations >= maxIterations) throw 'too many iterations'
        }

        if (list.length !== 1) throw 'something went wrong'
        if (list[0].from > wantedIp || list[0].to < wantedIp) throw 'result is not what we wanted'
        
        const result = {}
        Object.entries(list[0]).map(([key, entry]) => ['from', 'to'].includes(key) ? null : result[key] = entry)

        
        if (typeof this.store.data.linked === 'object') Object.entries(this.store.data.linked).map(([key, entries]) => {
          const link = result[key]
          if (typeof link === 'undefined' || typeof entries[link] !== 'object') return log.error(`[${this.config.name}] [findOne] failed to link ${key}: ${link}`)
          Object.entries(entries[link]).map(([key1, entry1]) => result[key1] = entry1)
        })

        /* filter ip2asn meaningless results */
        if (typeof result.asn === 'number' && result.asn === 0) delete result.asn
        if (typeof result.provider === 'string' && result.provider === 'Not routed') delete result.provider 
        if (typeof result.countryCode === 'string' && result.countryCode === 'None') delete result.countryCode

        log.debug(`[${this.config.name}] ${JSON.stringify({ iterations, ms: Date.now() - startTime }, null, 2)}`)
        return resolve(result)
      } catch (err) {
        return reject(typeof err === 'string' ? `[${this.config.name}] [findOne] ${err}` : err)
      }
    })
  }

  setReloadIntervall () {
    if (typeof this.reloadIntervall !== 'undefined') return null
    this.reloadIntervall = setInterval(() => this.download()
      .then(() => log.info(`[${this.config.name}] [reloadIntervall] successfully reloaded database`))
      .catch(err => {
        log.error(`[${this.config.name}] [reloadIntervall] failed to reload database`, err); 
        setTimeout(() => this.download()
          .then(() => log.info(`[${this.config.name}] [reloadIntervall] successfully reloaded database (second try)`))
          .catch(err => log.error(`[${this.config.name}] [reloadIntervall] failed to reload database (second try)`, err)),
        1000 * 60 * 15) // try again in 15 minutes 
      }),
    this.config.validFor)
  }
}
