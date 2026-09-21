#!/usr/bin/env node
/**
 * Azure Linux Oryx extracts node_modules.tar.gz to /node_modules and
 * renames wwwroot/node_modules -> _del_node_modules. Prefer the deployed
 * tree (uid, Nest, Prisma) over an incomplete /node_modules extract.
 */
const fs = require('node:fs');
const path = require('node:path');
const { Module } = require('node:module');

const root = __dirname;
const wwwrootModules = path.join(root, 'node_modules');
const deletedModules = path.join(root, '_del_node_modules');

function hasUid(dir) {
  return fs.existsSync(path.join(dir, 'uid', 'package.json'));
}

const extra = [];
if (hasUid(wwwrootModules)) extra.push(wwwrootModules);
if (hasUid(deletedModules)) extra.push(deletedModules);
if (fs.existsSync('/node_modules')) extra.push('/node_modules');

process.env.NODE_PATH = [...extra, process.env.NODE_PATH || ''].filter(Boolean).join(path.delimiter);
Module._initPaths();

require('./dist/main.js');
