#!/usr/bin/env node
"use strict";

/**
 * Fixes the yarn.lock to include the sha1 on all entries.
 *
 * For some URLs like codeload.github.com, yarn decides not to generate the sha1.
 */

const fs = require("fs");
const lockfile = require('@yarnpkg/lockfile');
const path = require("path");
const https = require("https");
const crypto = require('crypto');
const util = require("util");

function getSha1(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const { statusCode } = res;
      const hash = crypto.createHash('sha1');
      if (statusCode !== 200) {
        const err = new Error('Request Failed.\n' +
                          `Status Code: ${statusCode}`);
        // consume response data to free up memory
        res.resume();
        reject(err);
      }

      res.on('data', (chunk) => { hash.update(chunk); });
      res.on('end', () => { resolve(hash.digest('hex')) });
      res.on('error', reject);
    });
  });
};

function updateResolvedSha1(pkg) {
  // local dependency
  if (!pkg.resolved) { return Promise.resolve(); }
  let [url, sha1] = pkg.resolved.split("#", 2)
  if (!sha1) {
    return new Promise((resolve, reject) => {
      getSha1(url).then(sha1 => {
        pkg.resolved = `${url}#${sha1}`;
        resolve();
      }).catch(reject);
    });
  } else {
    // nothing to do
    return Promise.resolve();
  };
}

function values(obj) {
  var entries = [];
  for (let key in obj) {
    entries.push(obj[key]);
  }
  return entries;
}

// Main

const yarnLock = process.argv[2] || "yarn.lock";

let file = fs.readFileSync(yarnLock, 'utf8')
let json = lockfile.parse(file)

var pkgs = values(json.object);

Promise.all(pkgs.map(updateResolvedSha1)).then(() => {
  let fileAgain = lockfile.stringify(json.object);
  console.log(fileAgain);
})
