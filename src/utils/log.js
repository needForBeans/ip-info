const config = require('../../config.json')

const timestamp = () => `[${new Date(Date.now()).toLocaleString()}]`

module.exports = {
  info: (message, content) => console.info(`[\x1b[32mINFO\x1b[37m]  ${timestamp()} ${message}`, content? '\n' : '', content || ''),
  error: (message, content) => console.error(`[\x1b[31mERROR\x1b[37m] ${timestamp()} ${message}`, content? '\n' : '', content || ''),
  warn: config.warnings !== false ? (message, content) => console.error(`[\x1b[33mWARN\x1b[37m]  ${timestamp()} ${message}`, content? '\n' : '', content || '') : () => {},
  debug: config.debug === true ? (message, content) => console.debug(`[\x1b[34mDEBUG\x1b[37m] ${timestamp()} ${message}`, content? '\n' : '', content || '') : () => {},
}
