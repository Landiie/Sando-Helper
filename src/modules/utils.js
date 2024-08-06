module.exports = {
  getArgValue(query, args) {
    const arg = process.argv.filter(p => p.indexOf(query) >= 0)[0];
    if (arg === undefined) return undefined
    return arg.substring(arg.indexOf("=") + 1);
  }
};