module.exports = {
  toLong: (ip) => {
    var ipl=0
    ip.split('.').forEach(octet => { ipl<<=8; ipl+=parseInt(octet) })
    return(ipl >>>0)
  },
  fromLong: (ipl) => {
    return `${(ipl>>>24)}.${(ipl>>16 & 255)}.${(ipl>>8 & 255)}.${(ipl & 255)}`
  }
}
