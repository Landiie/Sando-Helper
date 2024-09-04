const domainLimits = {};

function rateLimit(url, limit, duration) {
  return new Promise(resolve => {
    const now = Date.now();

    const domain = getDomain(url);

    if (!domainLimits[domain]) {
      domainLimits[domain] = [];
    }

    const timestamps = domainLimits[domain];

    while (timestamps.length > 0 && now - timestamps[0] > duration) {
      timestamps.shift();
    }

    if (timestamps.length < limit) {
      timestamps.push(now);
      resolve();
    } else {
      const delay = duration - (now - timestamps[0]);
      setTimeout(() => {
        timestamps.push(Date.now());
        resolve();
      }, delay);
    }
  });
}

function getDomain(url) {
  const https = "https://";
  const http = "http://";

  if (!url.startsWith(https) && !url.startsWith(http)) console.log("no match");

  const queryLength = url.startsWith(https) ? https.length : http.length;

  const tempRemove = url.substring(0, queryLength);
  const noProtocol = url.replace(tempRemove, "");
  const slashPos = noProtocol.indexOf("/");
  let domain = "";
  if (slashPos !== -1) {
    domain = noProtocol.substring(noProtocol, slashPos);
  } else {
    domain = noProtocol.substring(noProtocol);
  }

  return domain;
}

module.exports = {
  async sFetch(url, options, delay = 1000) {
    const limit = 1; // per duration

    await rateLimit(url, limit, delay);
    const res = await fetch(url, options, delay);
    console.log(url + " done");
    return res;
  },
};
