# ip-info
<b>Local hosted api with zero dependencies for resolving ipV4 & ipV6 (beta).</b>
<br>
No actual database is used. All data gets stored in variables and JSON / CSV (temporary) files.
<br><br>
<b>Providers</b>
* <a href="https://mailfud.org/geoip-legacy/">mailfud</a>
* <a href="https://iptoasn.com/">ip2asn</a>
* <a href="https://db-ip.com/db/">db-ip</a>
* <a href="https://www.maxmind.com/en/geoip2-databases">maxmind</a> (licence key requied)

# requirements
* nodejs or docker

# install
```
git clone https://github.com/needForBeans/ip-info
```
you dont need to run 'npm install' as there are no dependencies
<br>

# config.json
A basic working configuration is provided.
<br><br>
required
``` 
{
  "port": Number | 8080
}
```
optional
```
{
  "slowLoad": Boolean  |  false
  "debug":    Boolean  |  false
  "warnings": Boolean  |  true
  "debugMem": Number   |  null          // log intervall in ms
  "NODE_ENV": String   |  "production"  // see docs
}
```
<a href="https://nodejs.dev/en/learn/nodejs-the-difference-between-development-and-production/">NODE_ENV docs</a>
<h3>IMPORTANT</h3>
if NODE_ENV is set to "development" it will not download new or delete temporary data if it exists.
<br>

<h3>maxmind</h3>
To use maxmind asn & city you need to add your licence key in maxmind.json

# start
```
node .
```
<br>

# docker
```
docker build . -t ip-info
docker compose up -d
```
Keep in mind to change the Dockerfile port if you change the default config.json port
<br>
The data folder is linked with a volume to the docker container. If you run it with node first the data will be available in the docker container.
<br>

# api
The api takes multiple ways of setting the wanted ip
* POST body: { ip: "" } headers: { "content-type": "application/json" }
* url query: localhost:8080/?ip=
* if nothing is set it will use the request ip
<br>

# api reponse
```
status: 200
data: {
  ...
}
```
error response
```
status: 401 | 500
data: {
  error: String
}
```
<br>

# Credits
* <a href="https://github.com/antelle/node-stream-zip">Antelle/node-stream-zip</a>
<br>

# Todo
* Add ipv6 global scope check (block private addresses)
