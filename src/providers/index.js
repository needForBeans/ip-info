const maxmindConfig = require('../../maxmind.json')
const oneDay = 24 * 60 * 60 * 1000

const { basicCountryFormatter, basicAsnFormatter, ipdbCityFormatter, maxmindAsnFormatter, maxmindCityFormatter, maxmindLocationFormatter } = require('./formatters')

module.exports = [
  {
    name: 'mailfud',
    validFor: oneDay * 3,
    src: 'https://mailfud.org/geoip-legacy/GeoIP-legacy.csv.gz',
    srcType: 'csv',
    asyncLineFormatter: csvItems => basicCountryFormatter(csvItems, 4)
  },
  {
    name: 'ip2asn',
    validFor: oneDay * 7,
    src: 'https://iptoasn.com/data/ip2asn-combined.tsv.gz',
    srcType: 'tsv',
    formatterConfig: { delimiter: '\t' },
    asyncLineFormatter: csvItems => basicAsnFormatter(csvItems, 4, 3)
  },
  {
    name: 'db-ip_country',
    validFor: oneDay * 14,
    src: 'https://download.db-ip.com/free/dbip-country-lite-2022-10.csv.gz',
    srcType: 'csv',
    asyncLineFormatter: csvItems => basicCountryFormatter(csvItems, 2) 
  },
  {
    name: 'db-ip_asn',
    validFor: oneDay * 14,
    src: 'https://download.db-ip.com/free/dbip-asn-lite-2022-10.csv.gz',
    srcType: 'csv',
    asyncLineFormatter: csvItems => basicAsnFormatter(csvItems, 3)
  },
  // memory limit reached when using this db! (+-2000mb)
  /* {
    name: 'db-ip_city',
    validFor: oneDay * 14,
    src: 'https://download.db-ip.com/free/dbip-city-lite-2022-10.csv.gz',
    srcType: 'csv',
    asyncLineFormatter: ipdbCityFormatter
  } */
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
