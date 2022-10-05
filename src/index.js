"use strict"
process.env.NODE_ENV = 'production'

const { config, providerConfig} = require('./utils/config')
const log = require('./utils/log')

const Provider = require('./provider')
const providers = providerConfig.map(conf => new Provider(conf))
log.debug(`providers: ${JSON.stringify(providers.map(p => p.config.name), null, 2)}`)

module.exports = { providers }

const server = require('./server')

function reloadDatabase (provider, retry) {
  return new Promise(async (resolve, reject) => {
    try {
      await provider.download()
      provider.setReloadIntervall()
      return resolve()
    } catch (err) {
      if (retry === true) return reject(err)
      log.error('error while reloading database, retry', err)
      reloadDatabase(provider, true)
        .then(() => resolve())
        .catch(err => reject(err))
    }
  })
}

function start () {
  return new Promise(async (resolve, reject) => {
    try {
      const promises = []
      for (const provider of providers) {
        log.info(`loading provider: ${provider.config.name}`)
        const promise = new Promise(async resolve => {
          try {
            if (!provider.databaseExists()) await reloadDatabase(provider)
            else {
              await provider.load().catch(async () => await reloadDatabase(provider))
              if (!provider.isLoaded()) throw `failed to load database`

              const validFor = provider.validFor()
              typeof validFor === 'number' && validFor > 1000 * 60 * 15 
                ? provider.reloadTimeout = setTimeout(async () => await reloadDatabase(provider), validFor)
                : await reloadDatabase(provider)
            }

            return resolve()
          } catch (err) {
            log.error(`[${provider.config.name}] failed to load.`, err)
          }
        })
        config.slowLoad === true 
          ? await promise.catch(() => { return null })
          : promises.push(promise)
      }

      if (promises.length > 0) await Promise.allSettled(promises)
      
      server.listen(config.port, (err) => {
        if (err) throw err
        log.info(`server started on port ${config.port}`)
        return resolve()
      })
    } catch (err) {
      return reject(err)
    } finally {
      providers.map(provider => provider.isLoaded() 
        ? log.info(`[${provider.config.name}] sucessfully loaded. valid for ${parseFloat(provider.validFor() / 1000 / 60 / 60).toFixed(2)} hour(s)`)
        : log.warn(`[${provider.config.name}] not loaded!`)
      )
    }
  })
}


start()
  .catch(err => {
    log.error('failed to start!', err)
    process.exit()
  })


