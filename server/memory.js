import { experienceText } from './seed.js';

const bounded = (operation, label) => Promise.race([
  operation,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after 8 seconds.`)), 8000))
]);

function terms(value = '') { return new Set(value.toLowerCase().match(/[a-z0-9-]{3,}/g) || []); }
function localRecall(incidents, query, currentId) {
  const queryTerms = terms(query);
  return incidents.filter(item => item.status === 'resolved' && item.id !== currentId)
    .map(item => {
      const text = experienceText(item); const itemTerms = terms(text);
      const matched = [...queryTerms].filter(term => itemTerms.has(term));
      return { incident: item, text, score: matched.length, matched };
    })
    .filter(item => item.score >= 2)
    .sort((a, b) => b.score - a.score).slice(0, 3);
}

export function hindsightConfigured() { return Boolean(process.env.HINDSIGHT_API_KEY && process.env.HINDSIGHT_BANK_ID); }
async function client() {
  const { HindsightClient } = await import('@vectorize-io/hindsight-client');
  return new HindsightClient({ baseUrl: process.env.HINDSIGHT_BASE_URL || 'https://api.hindsight.vectorize.io', apiKey: process.env.HINDSIGHT_API_KEY });
}
async function ensureBank(api) {
  await bounded(api.createBank(process.env.HINDSIGHT_BANK_ID, {
    name: 'OpsMind Production Memory',
    background: 'Durable production incident knowledge for an engineering team. Prioritize symptoms, services, deployments, root causes, failed investigation attempts, successful resolutions, and reusable operational lessons.'
  }), 'Hindsight bank creation');
}
export async function recallMemory(incidents, query, currentId) {
  if (!hindsightConfigured()) return { mode: 'local-demo', memories: localRecall(incidents, query, currentId), warning: 'Hindsight credentials are not configured. These results are from labelled local demo memory.' };
  try {
    const result = await client().then(api => bounded(api.recall(process.env.HINDSIGHT_BANK_ID, query, { limit: 3 }), 'Hindsight recall'));
    const memories = (result.results || []).slice(0, 3).map((item, index) => {
      const text = item.text || item.content || JSON.stringify(item); const id = text.match(/INC-\d+/)?.[0] || `Memory ${index + 1}`;
      return { incident: incidents.find(candidate => candidate.id === id) || { id, description: text, rootCause: 'See memory evidence', resolution: 'See memory evidence' }, text, source: item, score: null, matched: [] };
    });
    return { mode: 'hindsight', memories, warning: null };
  } catch (error) { return { mode: 'unavailable', memories: [], warning: `Hindsight recall was unavailable: ${error.message}` }; }
}
export async function retainExperience(incident) {
  if (!hindsightConfigured()) return { mode: 'local-demo', retained: false, warning: 'Saved locally for the demo. Add Hindsight credentials to retain this experience in Hindsight Cloud.' };
  try { await client().then(api => bounded(api.retain(process.env.HINDSIGHT_BANK_ID, experienceText(incident), { metadata: { incidentId: incident.id, service: incident.service, severity: incident.severity } }), 'Hindsight retain')); return { mode: 'hindsight', retained: true }; }
  catch (error) { return { mode: 'unavailable', retained: false, warning: `Hindsight retain failed: ${error.message}` }; }
}
export async function syncToHindsight(incidents) {
  if (!hindsightConfigured()) throw new Error('Add HINDSIGHT_API_KEY and HINDSIGHT_BANK_ID before syncing.');
  const api = await client();
  await ensureBank(api);
  const resolved = incidents.filter(item => item.status === 'resolved');
  await bounded(api.retainBatch(process.env.HINDSIGHT_BANK_ID, resolved.map(incident => ({ content: experienceText(incident), metadata: { incidentId: incident.id, service: incident.service, severity: incident.severity } })), { async: true }), 'Hindsight seed retain');
  return resolved.length;
}
