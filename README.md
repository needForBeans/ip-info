# ip-geolocation-api
<b>Local hosted api with zero dependencies for resolving ipV4 & ipV6 (beta) adresses to country with sub 10ms response times.</b>
<br />
No actual database is used. All data gets stored in variables and JSON / CSV (temporary) files. Database is auto refreshing.
<br /><br />

# requirements
* A provider like 'https://mailfud.org/geoip-legacy/' (in testing ~95% accuracy) for csv geoip data
* nodejs

# install
```
git clone https://github.com/needForBeans/ip-geolocation-api
```
you dont need to run 'npm install' as there are no dependencies

# config.json
A basic working configuration is provided.
```
{
  "port": 8080,
  "csv_src": "https://mailfud.org/geoip-legacy/GeoIP-legacy.csv.gz",
  "csv_refresh_days": 3
}
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

<b>Headers (important)</b> <br />
"content-type": "application/json"

# api reponse
```
status: 200
data: {
  ip: String,
  countryCode: String,
  country: String
}
```
error response
```
status: 401 | 500
data: {
  error: String
}
```

# Dependencies
All dependencies are built in to node and should not require an install
```
https
http
url
zlib (gunzip)
fs
```

# Todo
* Add ipv6 global scope check (block private addresses)
