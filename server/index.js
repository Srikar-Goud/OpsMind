import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { listIncidents, saveIncidents } from './store.js';
import { recallMemory, retainExperience, syncToHindsight, hindsightConfigured } from './memory.js';
import { investigate } from './ai.js';

const app = express(); app.use(cors()); app.use(express.json({ limit: '200kb' }));
const required = ['id','service','severity','description'];
const find = (items, id) => items.find(item => item.id === id);
app.get('/api/health', (_req, res) => res.json({ ok: true, memory: hindsightConfigured() ? 'hindsight' : 'local-demo', ai: process.env.AI_PROVIDER || 'local-demo' }));
app.get('/api/incidents', async (_req, res) => res.json(await listIncidents()));
app.post('/api/incidents', async (req, res) => { const missing = required.filter(key => !String(req.body[key] || '').trim()); if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` }); const incidents = await listIncidents(); if (find(incidents, req.body.id.trim())) return res.status(409).json({ error: 'An incident with that ID already exists.' }); const incident = { id: req.body.id.trim().toUpperCase(), service: req.body.service.trim(), severity: req.body.severity, deployment: req.body.deployment || '', description: req.body.description.trim(), logs: req.body.logs || '', status: 'open', memoryUsed: false, createdAt: new Date().toISOString() }; incidents.unshift(incident); await saveIncidents(incidents); res.status(201).json(incident); });
app.post('/api/incidents/:id/investigate', async (req, res) => { const incidents = await listIncidents(); const incident = find(incidents, req.params.id); if (!incident) return res.status(404).json({ error: 'Incident not found.' }); const query = `${incident.service} ${incident.description} ${incident.logs} ${incident.deployment}`; const memory = await recallMemory(incidents, query, incident.id); const ai = await investigate(incident, memory.memories); incident.memoryUsed = memory.memories.length > 0; incident.investigationResult = ai.investigation; await saveIncidents(incidents); res.json({ incident, memory: { ...memory, count: memory.memories.length }, ...ai }); });
app.post('/api/incidents/:id/resolve', async (req, res) => { const fields = ['rootCause','resolution','outcome','lesson']; const missing = fields.filter(key => !String(req.body[key] || '').trim()); if (missing.length) return res.status(400).json({ error: `Complete: ${missing.join(', ')}` }); const incidents = await listIncidents(); const incident = find(incidents, req.params.id); if (!incident) return res.status(404).json({ error: 'Incident not found.' }); Object.assign(incident, req.body, { status: 'resolved', resolvedAt: new Date().toISOString() }); const retained = await retainExperience(incident); await saveIncidents(incidents); res.json({ incident, retained }); });
app.get('/api/memory/search', async (req, res) => { const incidents = await listIncidents(); const memory = await recallMemory(incidents, String(req.query.q || ''), ''); res.json(memory); });
app.post('/api/memory/sync', async (_req, res) => { try { const count = await syncToHindsight(await listIncidents()); res.json({ count }); } catch (error) { res.status(400).json({ error: error.message }); } });
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: 'Unexpected server error.' }); });
app.listen(process.env.PORT || 8787, () => console.log(`OpsMind API listening on ${process.env.PORT || 8787}`));
