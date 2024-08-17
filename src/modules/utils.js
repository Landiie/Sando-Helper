const crypto = require('crypto')

module.exports = {
  getArgValue(query, args) {
    const arg = process.argv.filter(p => p.indexOf(query) >= 0)[0];
    if (arg === undefined) return undefined;
    return arg.substring(arg.indexOf("=") + 1);
  },
  arrayMerge(...others) {
    let mergedArr = [];
    for (let i = 0; i < others.length; i++) {
      const arr = others[i];
      mergedArr = Array.from(new Set(mergedArr.concat(arr)));
    }
    return mergedArr;
  },
  searchObjofObjs(targetObj, key, value) {
    const matched = [];
    const objs = Object.values(targetObj);
    objs.forEach(obj => {
      if (obj[key] === value) matched.push(obj);
    });
    return matched;
  },
  createHash(str) {
    return crypto.createHash("md5").update(str).digest("hex");
  },
};
