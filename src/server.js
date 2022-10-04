const http = require('http')
const url = require('url');

const { providers } = require('./index')
const ip = require('./utils/ip')
const log = require('./utils/log')
const countrycodeToCountry = require('./utils/countrycodeToCountry')

function getPostData (req) {
  return new Promise(resolve => {
    if (req.headers['content-type'] !== 'application/json') throw { customMessage: 'invalid content-type' }
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      if (body.length > 0) return resolve(JSON.parse(body).ip)
      resolve(false)
    })
  })
}

module.exports = http.createServer(async (req, res) => {
  try {
    const startTime = Date.now()
    const query = url.parse(req.url, true).query
    
    let wantedIp = req.method === 'POST' ? await getPostData(req) || query.ip || req.socket.remoteAddress : query.ip || req.socket.remoteAddress
    
    const version = ip.v4regex().test(wantedIp) ? 4 :
      ip.v4asv6regex().test(wantedIp) ? await new Promise(resolve => { wantedIp = wantedIp.split(':')[3]; resolve(4) }) :
        ip.v6regex().test(wantedIp) ? 6 : false
    
    if (typeof version !== 'number') throw { customMessage: 'invalid ip' }
    
    if (
      version === 4 && ip.isPrivateV4(wantedIp)
      // TODO: add v6 private scope check
    ) throw { customMessage: 'private ip' }

    const parsed = ip.parse({ ip: wantedIp, version })
    const result = { ip: wantedIp, ipV: version }
    const results = {}
    const promises = []

    res.on('finish', () => log.debug(`[${req.socket.remoteAddress}] ${wantedIp} => ${Date.now() - startTime}ms`, JSON.stringify(result, null, 2))) // success logger

    providers.map(provider => {
      if (provider.isLoaded()) promises.push(new Promise(async (resolve, reject) => {
        try {
          const response = await provider.findOne({ wantedIp: parsed.number, version })
          if (typeof response !== 'object') throw `[${provider.config.name}] invalid response`

          Object.entries(response).map(([key, entry]) => {
            if (typeof results[key] === 'undefined') return results[key] = entry
            if (!Array.isArray(results[key])) results[key] = [ results[key] ]
            results[key].push(entry)
          })
          return resolve()
        } catch (err) {
          log.error(`[${provider.config.name}] failed to find ip`, err)
          return reject(err)
        }
      }))
    })

    await Promise.allSettled(promises)

    if (Object.keys(results).length <= 0) throw 'failed to get data from providers' 
    
    Object.entries(results).map(([key, entry]) => !Array.isArray(entry) 
      ? result[key] = entry
      : key !== 'provider' 
        ? result[key] = entry.sort((a,b) => entry.filter(v => v===a).length - entry.filter(v => v===b).length).pop() // get the most common item in array
        : entry.map(info => typeof result.provider === 'undefined' ? result.provider = info : result.provider = `${result.provider} ${info}`)
    )
    
    if (typeof result.countryCode === 'string') result.country = countrycodeToCountry(result.countryCode) 
    if (typeof result.asn !== 'undefined') delete result.asn
    if (typeof result.geoname_id !== 'undefined') delete result.geoname_id

    res.writeHead(200, {'content-type': 'application/json', 'accept': 'application/json'})
    res.end(JSON.stringify(result))
  } catch (err) {
    if (err.customMessage) {
      log.debug(`[${req.socket.remoteAddress}] request error: ${err.customMessage}`)
      res.writeHead(401, {'content-type': 'application/json', 'accept': 'application/json'})
      res.end(JSON.stringify({ error: err.customMessage }))
    } else {
      log.error(`internal error:`, err)
      res.writeHead(500, {'content-type': 'application/json', 'accept': 'application/json'})
      res.end(JSON.stringify({ error: 'internal server error' }))
    }
  }
})
