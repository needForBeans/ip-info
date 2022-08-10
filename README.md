# geoip-local

# requirements
* npm
* nodejs

# install
```
npm i
```
# .env config
```
# port on which the api will be reachable
GEOIP_API_PORT=Number

# url of file to be downloaded
# guaranteed working: 'https://mailfud.org/geoip-legacy/GeoIP-legacy.csv.gz'
GEOIP_CSV_SRC=String

# refresh data after set days
GEOIP_SRC_VALID_FOR_DAYS=Number

# if you want to use a different provider and dont need to unzip the downloaded file
GEOIP_SKIP_UNZIP='anything'
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

# Todo
* Add ipV6 support
