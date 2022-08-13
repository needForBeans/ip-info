# ip-geolocation-api
  Free local hosted "database" & api for resolving ipV4 adress to country code & country with sub 10ms response times.
  <br />
  To keep it simple the downloaded geoip data is store in './data/geoip.json' with a timestamp.
  <br />
  No actual database is used. All data gets stored in variables.
  <br /><br />
  At startup and every 2 hours it checks if the data is older than your wanted config. If so it will refresh the data automatically.
  <br /><br />

# requirements
  * A provider like 'https://mailfud.org/geoip-legacy/' (in testing ~95% accuracy) for csv geoip data
  * npm
  * nodejs

# install
```
  git clone https://github.com/needForBeans/ip-geolocation-api
  cd ip-geolocation-api/
  npm i
```
# .env config
```
  # required

  # port on which the api will be reachable
  GEOIP_API_PORT=Number

  # url of file to be downloaded
  # guaranteed working: 'https://mailfud.org/geoip-legacy/GeoIP-legacy.csv.gz'
  GEOIP_CSV_SRC=String

  # refresh data after set days
  GEOIP_SRC_VALID_FOR_DAYS=Number


  # optional

  # if you want to use a different provider and dont need to unzip the downloaded file
  #GEOIP_SKIP_UNZIP='anything'
```

# start
```
  node .
```

# api
  The api takes multiple ways of setting the wanted ip
  * post body: { ip: '' }
  * url query: http://127.0.0.1:8080/?ip=
  * if nothing is set it will use the ip from the request

# api reponse
```
{
  ip: String,
  countryCode: String,
  country: String
}
```
error response
```
{
  error: String  
}
```

# Todo
  * Add ipV6 support
