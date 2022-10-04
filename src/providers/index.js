const maxmindConfig = require('../../maxmind.json')
const oneDay = 24 * 60 * 60 * 1000

const { mailfudFormatter, ip2asnFormatter, maxmindAsnFormatter, maxmindCityFormatter, maxmindLocationFormatter } = require('./formatters')

module.exports = [
  {
    name: 'mailfud',
    validFor: oneDay * 3,
    src: 'https://mailfud.org/geoip-legacy/GeoIP-legacy.csv.gz',
    srcType: 'csv',
    asyncLineFormatter: mailfudFormatter
  },
  {
    name: 'ip2asn',
    validFor: oneDay * 3,
    src: 'https://iptoasn.com/data/ip2asn-combined.tsv.gz',
    srcType: 'tsv',
    formatterConfig: { delimiter: '\t' },
    asyncLineFormatter: ip2asnFormatter
  }
].concat(typeof maxmindConfig.licenseKey !== 'string' || maxmindConfig.licenseKey.length < 5 ? []
: [
    {
      name: 'maxmind-asn',
      validFor: oneDay * 3,
      src: `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-ASN-CSV&license_key=${maxmindConfig.licenseKey}&suffix=zip`,
      srcType: 'folder',
      asyncFileFormatters: {
        "GeoLite2-ASN-Blocks-IPv4.csv": csvItems => maxmindAsnFormatter(csvItems, 4),
        "GeoLite2-ASN-Blocks-IPv6.csv": csvItems => maxmindAsnFormatter(csvItems, 6)
      }
    },
    {
      name: 'maxmind-city',
      validFor: oneDay * 3,
      src: `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City-CSV&license_key=${maxmindConfig.licenseKey}&suffix=zip`,
      srcType: 'folder',
      asyncFileFormatters: {
        "GeoLite2-City-Blocks-IPv4.csv": csvItems => maxmindCityFormatter(csvItems, 4),
        "GeoLite2-City-Blocks-IPv6.csv": csvItems => maxmindCityFormatter(csvItems, 6),
        "GeoLite2-City-Locations-en.csv": maxmindLocationFormatter
      }
    }
  ]
)
