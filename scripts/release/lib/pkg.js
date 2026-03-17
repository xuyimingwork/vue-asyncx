/**
 * package.json 读写
 */
import { readFileSync, writeFileSync } from 'fs';
import { exec } from './shell.js';
import { PACKAGE_JSON_PATH } from './config.js';

export function readPackageJson() {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
}

export function updatePackageJson(version) {
  const pkg = readPackageJson();
  pkg.version = version;
  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

export function doCommit(version) {
  exec('git add package.json CHANGELOG.md');
  exec(`git commit -m "release: ${version}"`);
}
