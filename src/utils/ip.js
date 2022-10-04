const privateRegex = [
  new RegExp('(172)\.(1[6-9]|2[0-9]|3[0-1])(\.(2[0-4][0-9]|25[0-5]|[1][0-9][0-9]|[1-9][0-9]|[0-9])){2}'),
  new RegExp('(192)\.(168)(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])){2}')
]
const privateIps = [ '127', '10' ]

const max4 = 2n ** 32n - 1n;
const max6 = 2n ** 128n - 1n;
const word = '[a-fA-F\\d:]';
const boundry = options => options && options.includeBoundaries ? `(?:(?<=\\s|^)(?=${word})|(?<=${word})(?=\\s|$))` : '';
const v4 = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}'
const v6segment = '[a-fA-F\\d]{1,4}';
const v6 = `
(?:
(?:${v6segment}:){7}(?:${v6segment}|:)|                                    // 1:2:3:4:5:6:7::  1:2:3:4:5:6:7:8
(?:${v6segment}:){6}(?:${v4}|:${v6segment}|:)|                             // 1:2:3:4:5:6::    1:2:3:4:5:6::8   1:2:3:4:5:6::8  1:2:3:4:5:6::1.2.3.4
(?:${v6segment}:){5}(?::${v4}|(?::${v6segment}){1,2}|:)|                   // 1:2:3:4:5::      1:2:3:4:5::7:8   1:2:3:4:5::8    1:2:3:4:5::7:1.2.3.4
(?:${v6segment}:){4}(?:(?::${v6segment}){0,1}:${v4}|(?::${v6segment}){1,3}|:)| // 1:2:3:4::        1:2:3:4::6:7:8   1:2:3:4::8      1:2:3:4::6:7:1.2.3.4
(?:${v6segment}:){3}(?:(?::${v6segment}){0,2}:${v4}|(?::${v6segment}){1,4}|:)| // 1:2:3::          1:2:3::5:6:7:8   1:2:3::8        1:2:3::5:6:7:1.2.3.4
(?:${v6segment}:){2}(?:(?::${v6segment}){0,3}:${v4}|(?::${v6segment}){1,5}|:)| // 1:2::            1:2::4:5:6:7:8   1:2::8          1:2::4:5:6:7:1.2.3.4
(?:${v6segment}:){1}(?:(?::${v6segment}){0,4}:${v4}|(?::${v6segment}){1,6}|:)| // 1::              1::3:4:5:6:7:8   1::8            1::3:4:5:6:7:1.2.3.4
(?::(?:(?::${v6segment}){0,5}:${v4}|(?::${v6segment}){1,7}|:))             // ::2:3:4:5:6:7:8  ::2:3:4:5:6:7:8  ::8             ::1.2.3.4
)(?:%[0-9a-zA-Z]{1,})?                                             // %eth0            %1
`.replace(/\s*\/\/.*$/gm, '').replace(/\n/g, '').trim()
const checkOptions = options => (typeof options === 'object' && options.exact !== false) || typeof options === 'undefined'  // exact default enabled

/* exports */
const v4regex = (options) => checkOptions(options) ? new RegExp(`^${v4}$`) : new RegExp(`${boundry(options)}${v4}${boundry(options)}`, 'g')
const v6regex = (options) => checkOptions(options) ? new RegExp(`^${v6}$`) : new RegExp(`${boundry(options)}${v6}${boundry(options)}`, 'g')
const v4asv6regex = () => new RegExp(`^::ffff:${v4}$`)

const getVersion = (ip) => v4regex().test(ip) ? 4 : v6regex().test(ip) ? 6 : false
const isPrivateV4 = (ip) => privateRegex.map(i => i.test(ip)).filter(i => i !== false).length > 0 ? true : privateIps.includes(ip.split('.')[0])

/* 
* TODO
* make parse & stringify return promise
*/

const parse = ({ ip, version }) => {
  if (![4, 6].includes(version)) throw new Error(`Invalid version: ${version}`);

  let number = 0n;
  let exp = 0n;

  if (version === 4) {
    for (const n of ip.split(".").map(Number).reverse()) {
      number += BigInt(n) * (2n ** BigInt(exp));
      exp += 8n;
    }
    return { number, version };
  } else if (version === 6) {
    const result = {};

    if (ip.includes(".")) {
      result.ipv4mapped = true;
      ip = ip.split(":").map(part => {
        if (part.includes(".")) {
          const digits = part.split(".").map(str => Number(str).toString(16).padStart(2, "0"));
          return `${digits[0]}${digits[1]}:${digits[2]}${digits[3]}`;
        } else {
          return part;
        }
      }).join(":");
    }

    if (ip.includes("%")) {
      let scopeid;
      [, ip, scopeid] = /(.+)%(.+)/.exec(ip);
      result.scopeid = scopeid;
    }

    const parts = ip.split(":");
    const index = parts.indexOf("");

    if (index !== -1) {
      while (parts.length < 8) {
        parts.splice(index, 0, "");
      }
    }

    for (const n of parts.map(part => part ? `0x${part}` : `0`).map(Number).reverse()) {
      number += BigInt(n) * (2n ** BigInt(exp));
      exp += 16n;
    }

    result.number = number;
    result.version = version;
    return result;
  }
}

const stringify = ({ number, version, ipv4mapped, scopeid }) => {
  if (typeof number !== "bigint") { 
    if (typeof number !== 'string') throw new Error(`Expected a BigInt`);
    number = BigInt(number)
  }
  if (![4, 6].includes(version)) throw new Error(`Invalid version: ${version}`);
  if (number < 0n || number > (version === 4 ? max4 : max6)) throw new Error(`Invalid number: ${number}`);

  let step = version === 4 ? 24n : 112n;
  let remain = number;
  const parts = [];

  while (step > 0n) {
    const divisor = 2n ** BigInt(step);
    parts.push(remain / divisor);
    remain = number % divisor;
    step -= BigInt(version === 4 ? 8 : 16);
  }
  parts.push(remain);

  if (version === 4) {
    return parts.map(Number).join(".");
  } else {
    let ip = "";
    if (ipv4mapped) {
      for (let [index, num] of Object.entries(parts.map(Number))) {
        index = Number(index);
        if (index < 6) {
          ip += `${num.toString(16)}:`;
        } else {
          ip += `${String(num >> 8)}.${String(num & 255)}${index === 6 ? "." : ""}`;
        }
      }
    } else {
      ip = parts.map(n => Number(n).toString(16)).join(":");
    }

    if (scopeid) {
      ip = `${ip}%${scopeid}`;
    }

    return ip.replace(/\b:?(?:0+:?){2,}/, "::");
  }
}

const cidrToRange = ({ cidr, version }) => {
  const { number } = parse({ ip: cidr.split('/')[0], version })
  return [
    stringify({ number, version }), // from
    stringify({ number: BigInt(Math.pow(2, 32 - cidr.split('/')[1]) + parseInt(number.toString()) - 1), version }) // to
  ]
}

module.exports = {
  v4regex,
  v4asv6regex,
  v6regex,
  getVersion,
  isPrivateV4,
  parse,
  stringify,
  cidrToRange
}
