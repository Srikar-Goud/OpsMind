const schema = {
  name: 'incident_investigation', strict: true,
  schema: { type: 'object', additionalProperties: false, required: ['summary','probableCauses','investigationSteps','recommendedAction','relatedIncidents','memoryInfluence'], properties: {
    summary: { type: 'string' },
    probableCauses: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['cause','reason','confidence'], properties: { cause: { type: 'string' }, reason: { type: 'string' }, confidence: { type: 'string', enum: ['low','medium','high'] } } } },
    investigationSteps: { type: 'array', items: { type: 'string' } }, recommendedAction: { type: 'string' },
    relatedIncidents: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['incidentId','reason'], properties: { incidentId: { type: 'string' }, reason: { type: 'string' } } } }, memoryInfluence: { type: 'string' }
  } }
};
function fallback(incident, memories) {
  const first = memories[0]?.incident; const dbLike = /connection|pool|database|timeout/i.test(`${incident.description} ${incident.logs}`);
  const cause = first?.rootCause || (dbLike ? 'Database connection pool saturation' : 'A deployment or dependency regression');
  return { summary: first ? `${incident.id} shares symptoms with ${first.id}. Validate the current signals before applying the earlier fix.` : `No relevant historical experience was found. Start with the deployment and the failing dependency.`, probableCauses: [{ cause, reason: first ? `Previous experience ${first.id} recorded: ${first.rootCause}.` : 'The reported symptoms need telemetry confirmation.', confidence: first ? 'medium' : 'low' }], investigationSteps: ['Compare the deployment configuration with the last healthy release.', 'Inspect the error log and dependency health at the incident timestamp.', dbLike ? 'Check active, idle, and waiting database connections against pool limits.' : 'Confirm the failing upstream dependency and request error rate.'], recommendedAction: first ? `Use ${first.id} as a hypothesis: ${first.resolution}. Apply it only after the current evidence confirms the same cause.` : 'Collect targeted telemetry, then record the verified root cause and resolution so this experience can be reused.', relatedIncidents: first ? memories.map(item => ({ incidentId: item.incident.id, reason: 'Relevant historical experience returned by memory search.' })) : [], memoryInfluence: first ? `The recommendation is shaped by ${memories.map(item => item.incident.id).join(', ')}; it is evidence to investigate, not an automatic remediation.` : 'No previous incident influenced this investigation.' };
}
async function providerCall(incident, memories) {
  const provider = process.env.AI_PROVIDER || 'openrouter';
  const key = provider === 'groq' ? process.env.GROQ_API_KEY : process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const endpoint = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
  const model = provider === 'groq' ? (process.env.GROQ_MODEL || 'openai/gpt-oss-20b') : (process.env.OPENROUTER_MODEL || 'openrouter/free');
  const memoryEvidence = memories.map(item => item.text).join('\n\n');
  const prompt = `Current incident:\n${JSON.stringify(incident)}\n\nMemory evidence returned by search:\n${memoryEvidence || 'No relevant historical experience was found.'}\n\nUse only incident IDs in the evidence. Do not claim certainty. Return the requested JSON.`;
  const response = await fetch(endpoint, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(provider === 'openrouter' ? { 'HTTP-Referer': 'http://localhost:5173', 'X-Title': 'OpsMind' } : {}) }, body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'system', content: 'You are an incident-response assistant. Treat recalled memory as evidence, not proof.' }, { role: 'user', content: prompt }], response_format: { type: 'json_schema', json_schema: schema } }) });
  if (!response.ok) throw new Error(`${provider} returned ${response.status}`);
  const payload = await response.json(); return JSON.parse(payload.choices?.[0]?.message?.content || '{}');
}
export async function investigate(incident, memories) {
  try { return { investigation: (await providerCall(incident, memories)) || fallback(incident, memories), aiMode: process.env.AI_PROVIDER && (process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY) ? process.env.AI_PROVIDER : 'local-demo' }; }
  catch (error) { return { investigation: fallback(incident, memories), aiMode: 'fallback', warning: `AI provider unavailable: ${error.message}` }; }
}
