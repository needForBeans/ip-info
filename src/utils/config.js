const fs = require('fs')
const path = require('path')

const config = require('../../config.json')
const providerConfig = require('../providers')
const log = require('./log')

const oneHour = 60 * 60 * 1000


/* hardcoded folders */
const folders = {
  temp: path.join(__dirname + '/../../data/temp'),
  data: path.join(__dirname + '/../../data')
}

if (!fs.existsSync(folders.data)) fs.mkdirSync(folders.data)
if (!fs.existsSync(folders.temp)) fs.mkdirSync(folders.temp)


/* main */
if (
  typeof config.port !== 'number' ||
  (
    typeof config.slowLoad !== 'boolean' &&
    typeof config.slowLoad !== 'undefined'
  ) ||
  (
    typeof config.debug !== 'boolean' &&
    typeof config.debug !== 'undefined'
  ) ||
  (
    (
      typeof config.debugMem !== 'number' &&
      config.debugMem > 1000
    ) &&
    typeof config.debugMem !== 'undefined'
  )
) return console.log('invalid config in config.json \nvalid config: \n  port: Number required\n  debug: boolean\n  debugMem: boolean')

if (typeof config.NODE_ENV === 'string') process.env.NODE_ENV = config.NODE_ENV

if (config.debugMem) setInterval(() => log.debug(`memory used: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`), config.debugMem)


/* providers */
const allowedSrcTypes = ['folder', 'csv', 'tsv']

if (
  !Array.isArray(providerConfig) ||
  providerConfig
    .map(provider => 
      typeof provider.name === 'string' &&
      typeof provider.validFor === 'number' &&
      typeof provider.src === 'string' &&
      typeof provider.srcType === 'string' &&
      (
        typeof provider.disableUnzip === 'undefined' ||
        typeof provider.disableUnzip === 'boolean'
      ) &&
      (
        typeof provider.formatterConfig === 'undefined' || (
          typeof provider.formatterConfig === 'object' &&
          (
            typeof provider.formatterConfig.delimiter === 'string' ||
            typeof provider.formatterConfig.delimiter === 'undefined'
          )
        )
      ) &&
      
      provider.validFor > oneHour * 12 &&
      allowedSrcTypes.includes(provider.srcType) &&
      
      provider.srcType !== 'folder' 
        ? typeof provider.asyncLineFormatter === 'function' 
        : (
          typeof provider.asyncFileFormatters === 'object' &&
          Object.entries(provider.asyncFileFormatters).length > 0 &&
          Object.entries(provider.asyncFileFormatters)
            .map(([key, func]) => typeof func === 'function')
            .filter(i => i !== true)
            .length <= 0
        )
    )
    .filter(i => i !== true)
    .length > 0
) throw 'invalid config in providers.js'


module.exports = {
  folders,
  config,
  providerConfig
}