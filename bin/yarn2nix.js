#!/usr/bin/env node
"use strict";

const path = require("path");

const child_process = require("child_process");

const HEAD = `
{fetchurl, fetchgit, linkFarm}: rec {
  offline_cache = linkFarm "offline" packages;
  packages = [
`.trim();

const nixPrefetchGit = "@NIX_PREFETCH_GIT@/bin/nix-prefetch-git";

function parseResolved(resolved) {
    let [url, sha1] = resolved.split("#");
    
    let type = "https";
    
    if(url.startsWith("git:")) {
        url = "git+https:" + url.slice("git:".length);
    }

    if(url.startsWith("git+http:")) {
        url = "git+https:" + url.slice("git+http:".length);
    }
    
    if(url.startsWith("git+https:")) {
        url = "https:" + url.slice("git+https:".length);
        type = "git";
    }
    
    const name = path.basename(url);

    return {
        "type": type,
        "name": name,
        "url":  url,
        "sha1": sha1
    };
}

function generateNix(lockedDependencies) {
    let found = {};

    console.log(HEAD);

    for(const depRange in lockedDependencies) {
        const dep = lockedDependencies[depRange];

        const depRangeParts = depRange.split('@');
        const {type, name, url, sha1} = parseResolved(dep["resolved"]);

        if(found.hasOwnProperty(name)) {
            continue;
        } else {
            found[name] = null;
        }

        let path_expr = "";

        if(type === "git") {
            const rev = sha1;
            const prefetchOutput = child_process.execSync(
                nixPrefetchGit + ` ${url} ${rev}`,
                { "stdio": ["ignore", "pipe", "ignore"] });
            const sha256 = JSON.parse(prefetchOutput)["sha256"];
            path_expr = `fetchgit {
        name   = "${name}";
        url    = "${url}";
        rev    = "${rev}";
        sha256 = "${sha256}";
      }`;
        } else if(type === "https") {
            path_expr = `fetchurl {
        name = "${name}";
        url  = "${url}";
        sha1 = "${sha1}";
      }`;
        } else {
            throw new Error("unknown url type: " + type);
        }

        console.log(`
    {
      name = "${name}";
      path = ${path_expr};
    }`);
    }

    console.log("  ];");
    console.log("}");
}

const yarnLock = process.argv[2] || "yarn.lock";
const fs = require("fs");
const lockfile = require('yarn-lockfile');

let file = fs.readFileSync(yarnLock, 'utf8');
let json = lockfile.parse(file);

if(json.type != "success") {
    throw new Error("yarn.lock parse error");
}

generateNix(json.object);
