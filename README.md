# ip-info
**Local hosted api with zero dependencies for resolving ipV4 & ipV6 (beta).**

No data is shared with any 3rd party. The ip will not leave your system and it could work offline if the database has alredy been downloaded.
All data gets stored in variables and JSON / CSV (temporary) files.

## Providers

* <a href="https://mailfud.org/geoip-legacy/">mailfud</a>
* <a href="https://iptoasn.com/">ip2asn</a>
* <a href="https://db-ip.com/db/">db-ip</a>
* <a href="https://www.maxmind.com/en/geoip2-databases">maxmind</a> (licence key requied)
* nodejs dns.reverse

## requirements
* nodejs or docker

## install
```bash
git clone https://github.com/needForBeans/ip-info
```
you dont need to run 'npm install' as there are no dependencies
<br>

## config.json

A basic working configuration is provided.

required

```js
{
  "port": Number // 8080
}
```

optional

```js
{
  "slowLoad": Boolean  //  false
  "debug":    Boolean  //  false
  "warnings": Boolean  //  true
  "debugMem": Number   //  null           log intervall in ms
  "NODE_ENV": String   //  "production"   see docs below
}
```

[NODE_ENV docs](https://nodejs.dev/en/learn/nodejs-the-difference-between-development-and-production/)

**IMPORTANT:** if NODE_ENV is set to "development" it will not download new or delete temporary data if it exists.

## maxmind

To use maxmind asn & city you need to add your licence key in maxmind.json

## start

```bash
node .
```

## docker

```bash
docker build . -t ip-info
docker compose up -d
```

Keep in mind to change the Dockerfile port if you change the default config.json port

The data folder is linked with a volume to the docker container. If you run it with node first the data will be available in the docker container.


## api

The api takes multiple ways of setting the wanted ip

* POST body: { ip: "" } headers: { "content-type": "application/json" }
* url query: localhost:8080/?ip=
* if nothing is set it will use the request ip

## api reponse

### success

```js
status: 200
data: {
  ...
}
```

### error

```js
status: 401 | 500
data: {
  error: String
}
```

## Credits

[Antelle/node-stream-zip](https://github.com/antelle/node-stream-zip) 

## Todos

* Add ipv6 global scope check (block private addresses)
