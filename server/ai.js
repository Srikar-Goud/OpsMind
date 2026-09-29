const schema = {
  name: 'incident_investigation',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'probableCauses',
      'investigationSteps',
      'recommendedAction',
      'relatedIncidents',
      'memoryInfluence'
    ],
    properties: {
      summary: {
        type: 'string'
      },

      probableCauses: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['cause', 'reason', 'confidence'],
          properties: {
            cause: {
              type: 'string'
            },
            reason: {
              type: 'string'
            },
            confidence: {
              type: 'string',
              enum: ['low', 'medium', 'high']
            }
          }
        }
      },

      investigationSteps: {
        type: 'array',
        items: {
          type: 'string'
        }
      },

      recommendedAction: {
        type: 'string'
      },

      relatedIncidents: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['incidentId', 'reason'],
          properties: {
            incidentId: {
              type: 'string'
            },
            reason: {
              type: 'string'
            }
          }
        }
      },

      memoryInfluence: {
        type: 'string'
      }
    }
  }
};

function fallback(incident, memories, reflection) {
  const first = memories[0]?.incident;

  const dbLike =
    /connection|pool|database|timeout/i.test(
      `${incident.description} ${incident.logs}`
    );

  const cause =
    first?.rootCause ||
    (dbLike
      ? 'Database connection pool saturation'
      : 'A deployment or dependency regression');

  const memoryText = first
    ? `Previous experience ${first.id} recorded: ${first.rootCause}.`
    : 'The reported symptoms need telemetry confirmation.';

  return {
    summary: first
      ? `${incident.id} shares symptoms with ${first.id}. Validate the current signals before applying the earlier fix.`
      : `No relevant historical experience was found. Start with the deployment and the failing dependency.`,

    probableCauses: [
      {
        cause,
        reason:
          reflection?.text ||
          memoryText,
        confidence: first ? 'medium' : 'low'
      }
    ],

    investigationSteps: [
      'Compare the deployment configuration with the last healthy release.',
      'Inspect the error log and dependency health at the incident timestamp.',
      dbLike
        ? 'Check active, idle, and waiting database connections against pool limits.'
        : 'Confirm the failing upstream dependency and request error rate.'
    ],

    recommendedAction: first
      ? `Use ${first.id} as a hypothesis: ${first.resolution}. Apply it only after current evidence confirms the same cause.`
      : 'Collect targeted telemetry, then record the verified root cause and resolution so this experience can be reused.',

    relatedIncidents: first
      ? memories.map(item => ({
          incidentId: item.incident.id,
          reason:
            'Relevant historical experience returned by Hindsight memory search.'
        }))
      : [],

    memoryInfluence: first
      ? `The recommendation is shaped by ${memories
          .map(item => item.incident.id)
          .join(', ')} and Hindsight reflection. Historical experience is evidence to investigate, not an automatic remediation.`
      : 'No previous incident influenced this investigation.'
  };
}

async function providerCall(
  incident,
  memories,
  reflection
) {
  const provider =
    process.env.AI_PROVIDER || 'openrouter';

  const key =
    provider === 'groq'
      ? process.env.GROQ_API_KEY
      : process.env.OPENROUTER_API_KEY;

  if (!key) {
    return null;
  }

  const endpoint =
    provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

  const model =
    provider === 'groq'
      ? process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
      : process.env.OPENROUTER_MODEL || 'openrouter/free';

  const memoryEvidence = memories
    .map(item => item.text)
    .join('\n\n');

  const reflectionText =
    reflection?.text ||
    'No Hindsight reflection was available.';

  const prompt = `
CURRENT INCIDENT:

${JSON.stringify(incident, null, 2)}

HINDSIGHT RECALL EVIDENCE:

${memoryEvidence || 'No relevant historical experience was found.'}

HINDSIGHT REFLECTION:

${reflectionText}

INSTRUCTIONS:

You are an incident-response assistant.

Use historical memory as operational evidence, not proof.

Compare the current incident against previous experiences.

Do not blindly copy a previous resolution.

Explain how historical memory influenced the investigation.

Only mention incident IDs that actually appear in the supplied evidence.

Do not invent facts.

Do not claim certainty without evidence.

Recommend investigation and verification steps.

Never recommend destructive autonomous production actions.

Return only the requested JSON.
`;

  const response = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),

    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',

      ...(provider === 'openrouter'
        ? {
            'HTTP-Referer':
              'http://localhost:5173',
            'X-Title': 'OpsMind'
          }
        : {})
    },

    body: JSON.stringify({
      model,
      temperature: 0.2,

      messages: [
        {
          role: 'system',
          content:
            'You are an incident-response assistant. Treat recalled Hindsight memory as evidence, not proof. The goal is to improve future incident investigations using accumulated operational experience.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],

      response_format: {
        type: 'json_schema',
        json_schema: schema
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `${provider} returned ${response.status}`
    );
  }

  const payload = await response.json();

  const content =
    payload.choices?.[0]?.message?.content || '{}';

  return JSON.parse(content);
}

export async function investigate(
  incident,
  memories,
  reflection
) {
  try {
    const investigation =
      (await providerCall(
        incident,
        memories,
        reflection
      )) ||
      fallback(
        incident,
        memories,
        reflection
      );

    return {
      investigation,

      aiMode:
        process.env.AI_PROVIDER &&
        (process.env.OPENROUTER_API_KEY ||
          process.env.GROQ_API_KEY)
          ? process.env.AI_PROVIDER
          : 'local-demo'
    };
  } catch (error) {
    return {
      investigation: fallback(
        incident,
        memories,
        reflection
      ),

      aiMode: 'fallback',

      warning:
        `AI provider unavailable: ${error.message}`
    };
  }
}