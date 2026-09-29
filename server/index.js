import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import {
  listIncidents,
  saveIncidents
} from './store.js';

import {
  recallMemory,
  reflectMemory,
  retainExperience,
  syncToHindsight,
  hindsightConfigured
} from './memory.js';

import { investigate } from './ai.js';

const app = express();

app.use(cors());

app.use(
  express.json({
    limit: '200kb'
  })
);

const required = [
  'id',
  'service',
  'severity',
  'description'
];

const find = (items, id) =>
  items.find(item => item.id === id);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,

    memory: hindsightConfigured()
      ? 'hindsight'
      : 'local-demo',

    ai:
      process.env.AI_PROVIDER ||
      'local-demo',

    bank:
      process.env.HINDSIGHT_BANK_ID ||
      null
  });
});

app.get(
  '/api/incidents',
  async (_req, res) => {
    res.json(await listIncidents());
  }
);

app.post(
  '/api/incidents',
  async (req, res) => {
    const missing = required.filter(
      key =>
        !String(req.body[key] || '').trim()
    );

    if (missing.length) {
      return res.status(400).json({
        error:
          `Missing required fields: ${missing.join(', ')}`
      });
    }

    const incidents =
      await listIncidents();

    const id =
      req.body.id.trim().toUpperCase();

    if (find(incidents, id)) {
      return res.status(409).json({
        error:
          'An incident with that ID already exists.'
      });
    }

    const incident = {
      id,

      service:
        req.body.service.trim(),

      severity:
        req.body.severity,

      deployment:
        req.body.deployment || '',

      description:
        req.body.description.trim(),

      logs:
        req.body.logs || '',

      status: 'open',

      memoryUsed: false,

      createdAt:
        new Date().toISOString()
    };

    incidents.unshift(incident);

    await saveIncidents(incidents);

    res.status(201).json(incident);
  }
);

app.post(
  '/api/incidents/:id/investigate',
  async (req, res) => {
    const incidents =
      await listIncidents();

    const incident =
      find(incidents, req.params.id);

    if (!incident) {
      return res.status(404).json({
        error: 'Incident not found.'
      });
    }

    const query = [
      incident.service,
      incident.severity,
      incident.description,
      incident.logs,
      incident.deployment
    ]
      .filter(Boolean)
      .join(' ');

    // STEP 1: Hindsight Recall
    const memory =
      await recallMemory(
        incidents,
        query,
        incident.id
      );

    // STEP 2: Hindsight Reflection
    const reflectionQuery = `
Current production incident:

${JSON.stringify(
  incident,
  null,
  2
)}

Analyze accumulated production incident experience
and identify:

- recurring symptoms
- recurring root causes
- successful fixes
- failed troubleshooting attempts
- patterns that may apply to the current incident

Explain what historical lessons should influence
the investigation.

Treat historical experience as evidence, not proof.
The current incident must still be verified.
`;

    const reflection =
      await reflectMemory(
        reflectionQuery
      );

    // STEP 3: LLM reasoning
    const ai =
      await investigate(
        incident,
        memory.memories,
        reflection
      );

    incident.memoryUsed =
      memory.memories.length > 0;

    incident.investigationResult =
      ai.investigation;

    await saveIncidents(
      incidents
    );

    res.json({
      incident,

      memory: {
        ...memory,
        count:
          memory.memories.length
      },

      reflection,

      ...ai
    });
  }
);

app.post(
  '/api/incidents/:id/resolve',
  async (req, res) => {
    const fields = [
      'rootCause',
      'resolution',
      'outcome',
      'lesson'
    ];

    const missing = fields.filter(
      key =>
        !String(req.body[key] || '').trim()
    );

    if (missing.length) {
      return res.status(400).json({
        error:
          `Complete: ${missing.join(', ')}`
      });
    }

    const incidents =
      await listIncidents();

    const incident =
      find(incidents, req.params.id);

    if (!incident) {
      return res.status(404).json({
        error: 'Incident not found.'
      });
    }

    Object.assign(
      incident,
      req.body,
      {
        status: 'resolved',
        resolvedAt:
          new Date().toISOString()
      }
    );

    // STEP 4: Hindsight Retain
    const retained =
      await retainExperience(
        incident
      );

    await saveIncidents(
      incidents
    );

    res.json({
      incident,
      retained
    });
  }
);

app.get(
  '/api/memory/search',
  async (req, res) => {
    const incidents =
      await listIncidents();

    const memory =
      await recallMemory(
        incidents,
        String(req.query.q || ''),
        ''
      );

    res.json(memory);
  }
);

app.post(
  '/api/memory/sync',
  async (_req, res) => {
    try {
      const count =
        await syncToHindsight(
          await listIncidents()
        );

      res.json({
        count,
        message:
          `${count} resolved experiences retained in Hindsight.`
      });
    } catch (error) {
      res.status(400).json({
        error: error.message
      });
    }
  }
);

app.use(
  (
    error,
    _req,
    res,
    _next
  ) => {
    console.error(error);

    res.status(500).json({
      error:
        'Unexpected server error.'
    });
  }
);

const PORT =
  process.env.PORT || 8787;

app.listen(
  PORT,
  () =>
    console.log(
      `OpsMind API listening on ${PORT}`
    )
);