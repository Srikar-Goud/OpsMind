import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Database,
  FileSearch,
  Lightbulb,
  LoaderCircle,
  Plus,
  ServerCrash,
  Sparkles,
  TriangleAlert,
  X
} from 'lucide-react';

import './styles.css';

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.error || 'Request failed'
    );
  }

  return body;
};

const blank = {
  id: 'INC-042',
  service: 'payments-api',
  severity: 'P1',
  deployment: 'v3.5.0',
  description:
    'Payment requests are again returning 502 errors after today’s deployment.',
  logs:
    'connection acquisition timeout; active=20 max=20'
};

const stateLabel = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved'
};

function Pill({
  children,
  tone = 'neutral'
}) {
  return (
    <span className={`pill ${tone}`}>
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  accent
}) {
  return (
    <article className="metric">
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>

      <span
        className={`metric-icon ${accent}`}
      >
        <Icon size={20} />
      </span>
    </article>
  );
}

function Empty({
  title,
  body
}) {
  return (
    <div className="empty">
      <BrainCircuit size={30} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function App() {
  const [
    incidents,
    setIncidents
  ] = useState([]);

  const [
    page,
    setPage
  ] = useState('dashboard');

  const [
    selectedId,
    setSelectedId
  ] = useState(null);

  const [
    health,
    setHealth
  ] = useState(null);

  const [
    result,
    setResult
  ] = useState(null);

  const [
    busy,
    setBusy
  ] = useState('');

  const [
    notice,
    setNotice
  ] = useState('');

  const [
    showCreate,
    setShowCreate
  ] = useState(false);

  const [
    form,
    setForm
  ] = useState(blank);

  const [
    resolve,
    setResolve
  ] = useState({
    rootCause: '',
    investigation:
      'Reviewed logs, release configuration, active connections, and dependency health.',
    failedAttempts: '',
    resolution: '',
    outcome:
      'Service health returned to normal.',
    lesson: ''
  });

  const refresh = async () => {
    const [
      list,
      status
    ] = await Promise.all([
      api('/api/incidents'),
      api('/api/health')
    ]);

    setIncidents(list);
    setHealth(status);

    if (
      !selectedId &&
      list[0]
    ) {
      setSelectedId(
        list[0].id
      );
    }
  };

  useEffect(() => {
    refresh().catch(error =>
      setNotice(error.message)
    );
  }, []);

  const selected =
    incidents.find(
      item =>
        item.id === selectedId
    ) || incidents[0];

  const stats = useMemo(
    () => ({
      total: incidents.length,

      resolved:
        incidents.filter(
          item =>
            item.status ===
            'resolved'
        ).length,

      assisted:
        incidents.filter(
          item =>
            item.memoryUsed
        ).length,

      patterns:
        new Set(
          incidents
            .filter(
              item =>
                item.status ===
                'resolved'
            )
            .map(
              item =>
                item.rootCause
            )
        ).size
    }),
    [incidents]
  );

  const choose = id => {
    setSelectedId(id);
    setResult(null);
    setPage('incidents');
  };

  const investigate = async () => {
    if (!selected) return;

    setBusy('investigate');
    setNotice('');

    try {
      const response =
        await api(
          `/api/incidents/${selected.id}/investigate`,
          {
            method: 'POST'
          }
        );

      setResult(response);

      await refresh();
    } catch (error) {
      setNotice(
        error.message
      );
    } finally {
      setBusy('');
    }
  };

  const create = async event => {
    event.preventDefault();

    setBusy('create');
    setNotice('');

    try {
      const incident =
        await api(
          '/api/incidents',
          {
            method: 'POST',
            body: JSON.stringify(form)
          }
        );

      await refresh();

      setSelectedId(
        incident.id
      );

      setResult(null);
      setShowCreate(false);
      setPage('incidents');
    } catch (error) {
      setNotice(
        error.message
      );
    } finally {
      setBusy('');
    }
  };

  const resolveIncident =
    async event => {
      event.preventDefault();

      if (!selected) return;

      setBusy('resolve');
      setNotice('');

      try {
        const response =
          await api(
            `/api/incidents/${selected.id}/resolve`,
            {
              method: 'POST',
              body: JSON.stringify(
                resolve
              )
            }
          );

        setNotice(
          response.retained
            .mode === 'hindsight'
            ? 'OpsMind learned from this incident in Hindsight Cloud.'
            : 'Incident resolved and saved to labelled local demo memory. Add Hindsight credentials to retain it in Hindsight Cloud.'
        );

        await refresh();
      } catch (error) {
        setNotice(
          error.message
        );
      } finally {
        setBusy('');
      }
    };

  const sync = async () => {
    setBusy('sync');

    try {
      const response =
        await api(
          '/api/memory/sync',
          {
            method: 'POST'
          }
        );

      setNotice(
        `${response.count} resolved experiences were retained in Hindsight Cloud.`
      );
    } catch (error) {
      setNotice(
        error.message
      );
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span>
            <BrainCircuit size={21} />
          </span>

          <div>
            OpsMind
            <small>
              INCIDENT INTELLIGENCE
            </small>
          </div>
        </div>

        <nav>
          {[
            [
              'dashboard',
              Activity,
              'Dashboard'
            ],
            [
              'incidents',
              TriangleAlert,
              'Incidents'
            ],
            [
              'memory',
              BrainCircuit,
              'Memory'
            ],
            [
              'learnings',
              Lightbulb,
              'Learnings'
            ]
          ].map(
            ([
              key,
              Icon,
              label
            ]) => (
              <button
                key={key}
                className={
                  page === key
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setPage(key)
                }
              >
                <Icon size={18} />
                {label}
              </button>
            )
          )}
        </nav>

        <div className="sidebar-bottom">
          <div
            className={`connection ${
              health?.memory ===
              'hindsight'
                ? 'live'
                : ''
            }`}
          >
            <i></i>

            {health?.memory ===
            'hindsight'
              ? 'Hindsight connected'
              : 'Demo memory mode'}
          </div>

          <p>
            Every resolution becomes reusable operational experience.
          </p>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">
              OPERATIONS CONSOLE
            </p>

            <h1>
              {page ===
              'dashboard'
                ? 'Team incident intelligence'
                : page === 'memory'
                ? 'Organizational memory'
                : page ===
                  'learnings'
                ? 'What OpsMind has learned'
                : 'Incident response'}
            </h1>
          </div>

          <div className="header-actions">
            <button
              className="secondary"
              onClick={sync}
              disabled={
                busy === 'sync'
              }
            >
              <Database size={16} />

              {busy === 'sync'
                ? 'Syncing'
                : 'Sync Hindsight'}
            </button>

            <button
              className="primary"
              onClick={() =>
                setShowCreate(true)
              }
            >
              <Plus size={17} />
              New incident
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice">
            <CheckCircle2 size={17} />

            <span>
              {notice}
            </span>

            <button
              onClick={() =>
                setNotice('')
              }
            >
              <X size={16} />
            </button>
          </div>
        )}

        {page ===
          'dashboard' && (
          <Dashboard
            incidents={incidents}
            stats={stats}
            choose={choose}
            setShowCreate={
              setShowCreate
            }
          />
        )}

        {page ===
          'incidents' && (
          <IncidentPage
            incident={selected}
            result={result}
            busy={busy}
            investigate={
              investigate
            }
            resolve={resolve}
            setResolve={
              setResolve
            }
            resolveIncident={
              resolveIncident
            }
          />
        )}

        {page ===
          'memory' && (
          <MemoryPage
            incidents={incidents}
            health={health}
            choose={choose}
          />
        )}

        {page ===
          'learnings' && (
          <Learnings
            incidents={incidents}
          />
        )}
      </main>

      {showCreate && (
        <CreateModal
          form={form}
          setForm={setForm}
          close={() =>
            setShowCreate(false)
          }
          create={create}
          busy={busy}
        />
      )}
    </div>
  );
}

function Dashboard({
  incidents,
  stats,
  choose,
  setShowCreate
}) {
  const recent =
    incidents.slice(0, 6);

  return (
    <>
      <section className="metrics">
        <Metric
          label="Total incidents"
          value={stats.total}
          icon={ServerCrash}
          accent="blue"
        />

        <Metric
          label="Resolved"
          value={stats.resolved}
          icon={CheckCircle2}
          accent="green"
        />

        <Metric
          label="Memory assisted"
          value={stats.assisted}
          icon={BrainCircuit}
          accent="violet"
        />

        <Metric
          label="Learned patterns"
          value={stats.patterns}
          icon={Sparkles}
          accent="orange"
        />
      </section>

      <section className="hero">
        <div>
          <Pill tone="violet">
            <BrainCircuit size={13} />
            Persistent incident memory
          </Pill>

          <h2>
            Make every production failure useful the next time.
          </h2>

          <p>
            OpsMind recalls durable operational experience, reflects over it, and uses it to guide a new investigation.
          </p>

          <button
            className="primary"
            onClick={() =>
              setShowCreate(true)
            }
          >
            Run the learning demo
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="loop">
          <span>Observe</span>
          <ChevronRight />
          <span>Recall</span>
          <ChevronRight />
          <span>Reflect</span>
          <ChevronRight />
          <span>Reason</span>
          <ChevronRight />
          <span>Learn</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">
              RECENT ACTIVITY
            </p>

            <h2>
              Incidents
            </h2>
          </div>

          <button
            className="text-button"
            onClick={() =>
              choose(
                recent[0]?.id
              )
            }
          >
            View all
            <ArrowRight size={15} />
          </button>
        </div>

        <IncidentTable
          items={recent}
          choose={choose}
        />
      </section>
    </>
  );
}

function IncidentPage({
  incident,
  result,
  busy,
  investigate,
  resolve,
  setResolve,
  resolveIncident
}) {
  if (!incident) {
    return (
      <Empty
        title="No incidents yet"
        body="Create an incident to begin."
      />
    );
  }

  const analysis =
    result?.investigation ||
    incident.investigationResult;

  const memory =
    result?.memory;

  const reflection =
    result?.reflection;

  return (
    <div className="incident-layout">
      <section>
        <div className="incident-head">
          <div>
            <div className="row">
              <Pill
                tone={
                  incident.severity ===
                  'P1'
                    ? 'red'
                    : 'amber'
                }
              >
                {incident.severity}
              </Pill>

              <Pill
                tone={
                  incident.status ===
                  'resolved'
                    ? 'green'
                    : 'blue'
                }
              >
                {
                  stateLabel[
                    incident.status
                  ]
                }
              </Pill>
            </div>

            <h2>
              {incident.id}
            </h2>

            <p>
              {incident.service} ·{' '}
              {incident.deployment ||
                'No deployment noted'}
            </p>
          </div>

          <button
            className="primary"
            onClick={investigate}
            disabled={
              busy ===
              'investigate'
            }
          >
            {busy ===
            'investigate' ? (
              <LoaderCircle
                className="spin"
                size={16}
              />
            ) : (
              <FileSearch
                size={16}
              />
            )}

            Investigate incident
          </button>
        </div>

        <article className="panel details">
          <p className="eyebrow">
            INCIDENT DETAILS
          </p>

          <h3>
            {incident.description}
          </h3>

          <div className="log">
            <span>
              LOG SIGNAL
            </span>

            {incident.logs ||
              'No logs supplied.'}
          </div>
        </article>

        {analysis ? (
          <Investigation
            analysis={analysis}
            memory={memory}
            reflection={
              reflection
            }
            aiMode={
              result?.aiMode
            }
            warning={
              result?.warning
            }
          />
        ) : (
          <div className="ready">
            <Sparkles size={21} />

            <div>
              <strong>
                Ready to investigate
              </strong>

              <p>
                OpsMind will recall and reflect over organizational memory before producing a structured investigation.
              </p>
            </div>
          </div>
        )}

        {incident.status !==
          'resolved' && (
          <form
            className="panel resolution"
            onSubmit={
              resolveIncident
            }
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">
                  CLOSE THE LOOP
                </p>

                <h2>
                  Resolve & learn
                </h2>
              </div>

              <BrainCircuit size={22} />
            </div>

            <p>
              Record durable operational knowledge for the next incident.
            </p>

            <div className="form-grid">
              <Field
                label="Actual root cause"
                value={
                  resolve.rootCause
                }
                onChange={value =>
                  setResolve({
                    ...resolve,
                    rootCause:
                      value
                  })
                }
              />

              <Field
                label="Successful resolution"
                value={
                  resolve.resolution
                }
                onChange={value =>
                  setResolve({
                    ...resolve,
                    resolution:
                      value
                  })
                }
              />

              <Field
                label="Investigation performed"
                value={
                  resolve.investigation
                }
                onChange={value =>
                  setResolve({
                    ...resolve,
                    investigation:
                      value
                  })
                }
              />

              <Field
                label="Failed attempts"
                value={
                  resolve.failedAttempts
                }
                onChange={value =>
                  setResolve({
                    ...resolve,
                    failedAttempts:
                      value
                  })
                }
              />

              <Field
                label="Outcome"
                value={
                  resolve.outcome
                }
                onChange={value =>
                  setResolve({
                    ...resolve,
                    outcome:
                      value
                  })
                }
              />

              <Field
                label="Lesson learned"
                value={
                  resolve.lesson
                }
                onChange={value =>
                  setResolve({
                    ...resolve,
                    lesson:
                      value
                  })
                }
              />
            </div>

            <button
              className="primary"
              disabled={
                busy === 'resolve'
              }
            >
              {busy ===
              'resolve' ? (
                <LoaderCircle
                  className="spin"
                  size={16}
                />
              ) : (
                <BrainCircuit
                  size={16}
                />
              )}

              Resolve & learn
            </button>
          </form>
        )}
      </section>

      <aside className="context">
        <p className="eyebrow">
          INCIDENT TIMELINE
        </p>

        <div className="timeline">
          <div>
            <i className="done"></i>

            <strong>
              Incident created
            </strong>

            <span>
              {new Date(
                incident.createdAt
              ).toLocaleString()}
            </span>
          </div>

          <div>
            <i
              className={
                memory
                  ? 'done'
                  : ''
              }
            ></i>

            <strong>
              Hindsight recall
            </strong>

            <span>
              {memory
                ? 'Recall completed'
                : 'Waiting to investigate'}
            </span>
          </div>

          <div>
            <i
              className={
                reflection?.text
                  ? 'done'
                  : ''
              }
            ></i>

            <strong>
              Hindsight reflection
            </strong>

            <span>
              {reflection?.text
                ? 'Reflection completed'
                : 'Waiting for memory reasoning'}
            </span>
          </div>

          <div>
            <i
              className={
                incident.status ===
                'resolved'
                  ? 'done'
                  : ''
              }
            ></i>

            <strong>
              Resolution retained
            </strong>

            <span>
              {incident.status ===
              'resolved'
                ? 'Experience stored'
                : 'Waiting for outcome'}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Investigation({
  analysis,
  memory,
  reflection,
  aiMode,
  warning
}) {
  return (
    <>
      <section className="panel investigation">
        <div className="panel-title">
          <div>
            <p className="eyebrow">
              AI INVESTIGATION
            </p>

            <h2>
              Evidence-led recommendation
            </h2>
          </div>

          <Pill
            tone={
              aiMode ===
              'local-demo'
                ? 'amber'
                : 'green'
            }
          >
            {aiMode ===
            'local-demo'
              ? 'Demo reasoning'
              : aiMode ===
                'fallback'
              ? 'Fallback response'
              : 'AI assisted'}
          </Pill>
        </div>

        {warning && (
          <div className="warning">
            <AlertTriangle
              size={16}
            />

            {warning}
          </div>
        )}

        <p className="summary">
          {analysis.summary}
        </p>

        <div className="cause-grid">
          {analysis.probableCauses.map(
            (
              cause,
              index
            ) => (
              <article
                key={index}
              >
                <Pill
                  tone={
                    cause.confidence ===
                    'high'
                      ? 'red'
                      : cause.confidence ===
                        'medium'
                      ? 'amber'
                      : 'neutral'
                  }
                >
                  {
                    cause.confidence
                  }{' '}
                  confidence
                </Pill>

                <h3>
                  {cause.cause}
                </h3>

                <p>
                  {cause.reason}
                </p>
              </article>
            )
          )}
        </div>

        <div className="steps">
          <h3>
            Investigation steps
          </h3>

          {analysis.investigationSteps.map(
            (
              step,
              index
            ) => (
              <div
                key={step}
              >
                <span>
                  {index + 1}
                </span>

                {step}
              </div>
            )
          )}

          <div className="action">
            <Sparkles size={17} />

            <div>
              <strong>
                Recommended action
              </strong>

              <p>
                {
                  analysis.recommendedAction
                }
              </p>
            </div>
          </div>
        </div>
      </section>

      <DecisionTrace
        analysis={analysis}
        memory={memory}
        reflection={reflection}
      />

      <section className="memory-evidence">
        <div className="memory-head">
          <div>
            <Pill tone="violet">
              <BrainCircuit
                size={13}
              />
              MEMORY USED
            </Pill>

            <h2>
              {memory
                ? `${memory.count} relevant historical experience${
                    memory.count ===
                    1
                      ? ''
                      : 's'
                  } found`
                : 'Memory evidence will appear here'}
            </h2>

            <p>
              {memory?.mode ===
              'hindsight'
                ? 'Hindsight recall completed. These are returned memory records.'
                : memory?.warning ||
                  'Run an investigation to search organizational memory.'}
            </p>
          </div>

          <div className="memory-badge">
            Hindsight
            <br />

            <strong>
              {memory?.mode ===
              'hindsight'
                ? 'Recall completed'
                : 'Demo adapter'}
            </strong>
          </div>
        </div>

        {reflection?.text && (
          <div className="reflection-card">
            <div className="reflection-label">
              HINDSIGHT REFLECTION
            </div>

            <p>
              {reflection.text}
            </p>

            {reflection.basedOn?.length >
              0 && (
              <small>
                Reasoned from{' '}
                {
                  reflection
                    .basedOn
                    .length
                }{' '}
                Hindsight source
                {reflection
                  .basedOn
                  .length ===
                1
                  ? ''
                  : 's'}
                .
              </small>
            )}
          </div>
        )}

        {memory?.memories
          ?.length ? (
          <div className="memory-list">
            {memory.memories.map(
              (
                item,
                index
              ) => (
                <article
                  key={index}
                >
                  <div className="memory-number">
                    {String(
                      index + 1
                    ).padStart(
                      2,
                      '0'
                    )}
                  </div>

                  <div>
                    <div className="row">
                      <strong>
                        {
                          item
                            .incident
                            .id
                        }
                      </strong>

                      <Pill tone="violet">
                        Relevant experience
                      </Pill>
                    </div>

                    <h3>
                      {
                        item
                          .incident
                          .description
                      }
                    </h3>

                    <p>
                      <b>
                        Root cause:
                      </b>{' '}
                      {
                        item
                          .incident
                          .rootCause
                      }
                    </p>

                    <p>
                      <b>
                        Resolution:
                      </b>{' '}
                      {
                        item
                          .incident
                          .resolution
                      }
                    </p>
                  </div>
                </article>
              )
            )}
          </div>
        ) : (
          <Empty
            title="No relevant historical experience"
            body="Resolve an incident to create durable operational memory."
          />
        )}

        <div className="influence">
          <BrainCircuit size={19} />

          <span>
            <b>
              How memory influenced this:
            </b>{' '}
            {
              analysis.memoryInfluence
            }
          </span>
        </div>
      </section>
    </>
  );
}

function DecisionTrace({
  analysis,
  memory,
  reflection
}) {
  const memoryCount = memory?.count || 0;
  const hasReflection = Boolean(reflection?.text);
  const hasDecision = Boolean(analysis?.recommendedAction);

  return (
    <section className="decision-trace panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">MEMORY → DECISION TRACE</p>
          <h2>How previous experience changed this investigation</h2>
        </div>
        <Pill tone="violet">Traceable reasoning</Pill>
      </div>

      <div className="trace-grid">
        <article className="trace-step">
          <span className="trace-index">01</span>
          <div>
            <small>HINDSIGHT RECALL</small>
            <strong>{memoryCount} historical {memoryCount === 1 ? 'experience' : 'experiences'} returned</strong>
            <p>Relevant resolved incidents become evidence for the current investigation.</p>
          </div>
        </article>

        <article className={hasReflection ? 'trace-step complete' : 'trace-step'}>
          <span className="trace-index">02</span>
          <div>
            <small>HINDSIGHT REFLECTION</small>
            <strong>{hasReflection ? 'Historical patterns synthesized' : 'Waiting for reflection'}</strong>
            <p>{hasReflection ? 'Hindsight connected the recalled experience to the current incident.' : 'Run an investigation with live Hindsight memory enabled.'}</p>
          </div>
        </article>

        <article className={hasDecision ? 'trace-step complete' : 'trace-step'}>
          <span className="trace-index">03</span>
          <div>
            <small>AI INVESTIGATION</small>
            <strong>{hasDecision ? 'Recommendation shaped by evidence' : 'Waiting for investigation'}</strong>
            <p>{hasDecision ? analysis.recommendedAction : 'The model will use current signals plus historical evidence, not memory alone.'}</p>
          </div>
        </article>
      </div>

      <div className="trace-rule">
        <BrainCircuit size={16} />
        <span>Memory is evidence, not automatic remediation. The current incident still has to be verified.</span>
      </div>
    </section>
  );
}

function MemoryPage({
  incidents,
  health,
  choose
}) {
  const learned =
    incidents
      .filter(
        item =>
          item.status ===
          'resolved'
      )
      .slice()
      .reverse();

  return (
    <>
      <section className="memory-overview">
        <div>
          <Pill tone="violet">
            <BrainCircuit
              size={13}
            />
            HINDSIGHT MEMORY BANK
          </Pill>

          <h2>
            Experience is visible, traceable, and reusable.
          </h2>

          <p>
            {health?.memory ===
            'hindsight'
              ? 'Live Hindsight Cloud retain, recall, and reflection are configured for this memory bank.'
              : 'Preview mode uses seeded local experiences until Hindsight Cloud credentials are added.'}
          </p>
        </div>

        <div className="bank-stat">
          <span>
            REUSABLE EXPERIENCES
          </span>

          <strong>
            {learned.length}
          </strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">
              MEMORY TIMELINE
            </p>

            <h2>
              Recent learned experiences
            </h2>
          </div>
        </div>

        <div className="memory-timeline">
          {learned.map(
            item => (
              <button
                key={item.id}
                onClick={() =>
                  choose(
                    item.id
                  )
                }
              >
                <i></i>

                <span>
                  {new Date(
                    item.resolvedAt ||
                      item.createdAt
                  ).toLocaleDateString()}
                </span>

                <strong>
                  {item.id} ·{' '}
                  {item.service}
                </strong>

                <p>
                  Learned:{' '}
                  {
                    item.rootCause
                  }
                </p>

                <ChevronRight
                  size={16}
                />
              </button>
            )
          )}
        </div>
      </section>
    </>
  );
}

function Learnings({
  incidents
}) {
  const groups =
    Object.values(
      incidents
        .filter(
          item =>
            item.status ===
            'resolved'
        )
        .reduce(
          (
            all,
            item
          ) => {
            const key =
              item.rootCause ||
              'Unclassified';

            (all[key] ||=
              []).push(
              item
            );

            return all;
          },
          {}
        )
    ).filter(
      group =>
        group.length ||
        group[0]
    );

  return (
    <section className="learning-grid">
      <div className="panel intro">
        <Pill tone="violet">
          <Lightbulb
            size={13}
          />
          SUPPORTED BY STORED INCIDENTS
        </Pill>

        <h2>
          Operational patterns that now survive the incident.
        </h2>

        <p>
          Each pattern is generated from a resolved incident in the current memory bank.
        </p>
      </div>

      {groups.map(
        group => (
          <article
            className="learning-card"
            key={
              group[0]
                .rootCause
            }
          >
            <span className="dot"></span>

            <p>
              {group.length >
              1
                ? `${group.length} related experiences`
                : group[0]
                    .service}
            </p>

            <h3>
              {
                group[0]
                  .rootCause
              }
            </h3>

            <div>
              {
                group[0]
                  .lesson
              }
            </div>

            <small>
              Evidence:{' '}
              {group
                .map(
                  item =>
                    item.id
                )
                .join(', ')}
            </small>
          </article>
        )
      )}
    </section>
  );
}

function IncidentTable({
  items,
  choose
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              Incident
            </th>

            <th>
              Service
            </th>

            <th>
              Severity
            </th>

            <th>
              Status
            </th>

            <th>
              Memory
            </th>

            <th></th>
          </tr>
        </thead>

        <tbody>
          {items.map(
            item => (
              <tr
                key={item.id}
                onClick={() =>
                  choose(
                    item.id
                  )
                }
              >
                <td>
                  <strong>
                    {item.id}
                  </strong>

                  <span>
                    {
                      item.description
                    }
                  </span>
                </td>

                <td>
                  {item.service}
                </td>

                <td>
                  <Pill
                    tone={
                      item.severity ===
                      'P1'
                        ? 'red'
                        : 'amber'
                    }
                  >
                    {
                      item.severity
                    }
                  </Pill>
                </td>

                <td>
                  <Pill
                    tone={
                      item.status ===
                      'resolved'
                        ? 'green'
                        : 'blue'
                    }
                  >
                    {
                      stateLabel[
                        item.status
                      ]
                    }
                  </Pill>
                </td>

                <td>
                  {item.memoryUsed ? (
                    <span className="memory-used">
                      <BrainCircuit
                        size={14}
                      />
                      Used
                    </span>
                  ) : (
                    <span className="muted">
                      —
                    </span>
                  )}
                </td>

                <td>
                  <ChevronRight
                    size={17}
                  />
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({
  label,
  value,
  onChange
}) {
  return (
    <label>
      {label}

      <textarea
        value={value}
        onChange={event =>
          onChange(
            event.target.value
          )
        }
        required={[
          'Actual root cause',
          'Successful resolution',
          'Outcome',
          'Lesson learned'
        ].includes(label)}
        rows="2"
      />
    </label>
  );
}

function CreateModal({
  form,
  setForm,
  close,
  create,
  busy
}) {
  const update = (
    key,
    value
  ) =>
    setForm({
      ...form,
      [key]: value
    });

  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        onSubmit={create}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">
              NEW PRODUCTION INCIDENT
            </p>

            <h2>
              Start an investigation
            </h2>
          </div>

          <button
            type="button"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>

        <div className="form-grid">
          <label>
            Incident ID

            <input
              value={form.id}
              onChange={e =>
                update(
                  'id',
                  e.target.value
                )
              }
              required
            />
          </label>

          <label>
            Service

            <input
              value={form.service}
              onChange={e =>
                update(
                  'service',
                  e.target.value
                )
              }
              required
            />
          </label>

          <label>
            Severity

            <select
              value={
                form.severity
              }
              onChange={e =>
                update(
                  'severity',
                  e.target.value
                )
              }
            >
              <option>
                P1
              </option>

              <option>
                P2
              </option>

              <option>
                P3
              </option>
            </select>
          </label>

          <label>
            Deployment/version

            <input
              value={
                form.deployment
              }
              onChange={e =>
                update(
                  'deployment',
                  e.target.value
                )
              }
            />
          </label>

          <label className="full">
            Description

            <textarea
              rows="3"
              value={
                form.description
              }
              onChange={e =>
                update(
                  'description',
                  e.target.value
                )
              }
              required
            />
          </label>

          <label className="full">
            Logs or error message

            <textarea
              rows="3"
              value={form.logs}
              onChange={e =>
                update(
                  'logs',
                  e.target.value
                )
              }
            />
          </label>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={close}
          >
            Cancel
          </button>

          <button
            className="primary"
            disabled={
              busy === 'create'
            }
          >
            {busy ===
            'create' ? (
              <LoaderCircle
                className="spin"
                size={16}
              />
            ) : (
              <Plus size={16} />
            )}

            Create incident
          </button>
        </div>
      </form>
    </div>
  );
}

createRoot(
  document.getElementById('root')
).render(<App />);