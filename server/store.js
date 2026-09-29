import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedIncidents } from './seed.js';

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'incidents.json');
let queue = Promise.resolve();

async function ensure() {
  try { await fs.access(dataFile); } catch { await fs.writeFile(dataFile, JSON.stringify(seedIncidents, null, 2)); }
}
export async function listIncidents() { await ensure(); return JSON.parse(await fs.readFile(dataFile, 'utf8')); }
export async function saveIncidents(incidents) {
  await ensure();
  queue = queue.then(() => fs.writeFile(dataFile, JSON.stringify(incidents, null, 2)));
  await queue;
}
