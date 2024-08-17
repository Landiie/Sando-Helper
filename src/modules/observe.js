const chokidar = require("chokidar");
const { EventEmitter } = require("events");
const utils = require("./utils");

const events = new EventEmitter();

module.exports = {
  events: events,
  watchers: {},
  file(filepath, id) {
    const watcher = chokidar.watch(filepath);
    watcher.on("change", filepath => {
      events.emit(`changed:${id}`, filepath);
    });
    this.watchers[id] = watcher;
  },
};
