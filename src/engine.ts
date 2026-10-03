/** Original ResumeHere deterministic graph engine. Flat decisions intentionally exclude
 * decision prerequisites and gated decisions; action forks and rejoins remain supported. */
export type Answer = 'yes' | 'no';
/** Shared write/read ceilings: character count matches JSON string storage checks. */
export const MAX_SNAPSHOT_CHARS = 5_000_000;
export const MAX_HISTORY_ENTRIES = 5_000;
export interface GuideNode { id: string; type: 'action' | 'decision'; text: string; prerequisites: string[]; condition?: { decisionId: string; answer: Answer }; source?: { start: number; end: number }; }
export type Node = GuideNode;
export interface Guide { id: string; title: string; source: string; version: number; nodes: GuideNode[]; }
export type NodeState = 'unresolved-condition' | 'inactive-by-choice' | 'blocked-by-prerequisite' | 'available' | 'done';
export interface StateExplanation { state: NodeState; reason: string; }
export interface ValidationIssue { nodeId?: string; field: string; message: string; }
export type Transition = { type: 'answer'; nodeId: string; answer: Answer | null } | { type: 'uncomplete'; nodeId: string } | { type: 'edit'; guide: Guide };
export type Event = Transition | { type: 'complete'; nodeId: string };
interface Frame { guide: Guide; answers: Record<string, Answer>; completed: string[]; }
export interface HistoryEntry { event: Event; before: Frame; reason: string; reset: string[]; }
export interface Session { version: 1; guideId: string; guideVersion: number; guideHash: string; answers: Record<string, Answer>; completed: string[]; history: HistoryEntry[]; }
export interface TransitionPreview { affected: string[]; reset: string[]; retained: string[]; reason: string; }
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const validId = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(x) && !['prototype', '__proto__'].includes(x) && !Object.prototype.hasOwnProperty.call(Object.prototype, x);
const answer = (x: unknown): x is Answer => x === 'yes' || x === 'no';
const canonical = (x: unknown): string => {
  if (Array.isArray(x)) return '[' + Array.from(x, value => value === undefined ? 'null' : canonical(value)).join(',') + ']';
  if (object(x)) return '{' + Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
  return JSON.stringify(x);
};
/** Exact canonical identity, intentionally not a cryptographic security checksum. */
export const guideHash = (guide: Guide): string => canonical(guide);
export function validateGuide(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: string, message: string, nodeId?: string) => issues.push({ field, message, ...(nodeId ? { nodeId } : {}) });
  if (!object(input)) return [{ field: 'guide', message: 'Guide must be an object.' }];
  if (!validId(input.id)) add('id', 'Use a stable ID of 1–64 letters, numbers, underscores or hyphens.');
  if (typeof input.title !== 'string' || !input.title.trim()) add('title', 'Give this guide a title.');
  if (typeof input.source !== 'string') add('source', 'Source must be text.');
  if (!Number.isSafeInteger(input.version) || (input.version as number) < 1) add('version', 'Version must be a positive integer.');
  if (!Array.isArray(input.nodes)) return [...issues, { field: 'nodes', message: 'Nodes must be a list.' }];
  const raw = input.nodes;
  if (!raw.some(n => object(n) && n.type === 'action')) add('nodes', 'Add at least one action.');
  if (raw.filter(n => object(n) && n.type === 'action').length > 12) add('nodes', 'A guide supports at most 12 actions.');
  if (raw.filter(n => object(n) && n.type === 'decision').length > 4) add('nodes', 'A guide supports at most 4 decisions.');
  const ids = new Set<string>();
  for (const n of raw) {
    if (!object(n)) { add('nodes', 'Each node must be an object.'); continue; }
    const id = typeof n.id === 'string' ? n.id : undefined;
    if (!validId(n.id)) add('id', 'Use a valid stable node ID.', id);
    else { if (ids.has(n.id)) add('id', 'Node IDs must be unique.', n.id); ids.add(n.id); }
    if (!['action', 'decision'].includes(n.type as string)) add('type', 'Choose action or decision.', id);
    if (typeof n.text !== 'string' || !n.text.trim()) add('text', 'Add the exact instruction or question.', id);
    if (!Array.isArray(n.prerequisites) || n.prerequisites.some(p => typeof p !== 'string')) add('prerequisites', 'Prerequisites must be a list of node IDs.', id);
    else if (new Set(n.prerequisites).size !== n.prerequisites.length) add('prerequisites', 'Remove duplicate prerequisites.', id);
    if (n.condition !== undefined && (!object(n.condition) || typeof n.condition.decisionId !== 'string' || !answer(n.condition.answer))) add('condition', 'A condition needs a decision ID and yes/no answer.', id);
    if (n.type === 'decision' && (n.condition !== undefined || (Array.isArray(n.prerequisites) && n.prerequisites.length))) add('condition', 'Decisions must be independent: nested or prerequisite-gated decisions are not supported.', id);
    if (n.source !== undefined && (!object(n.source) || !Number.isSafeInteger(n.source.start) || !Number.isSafeInteger(n.source.end) || (n.source.start as number) < 0 || (n.source.end as number) <= (n.source.start as number) || typeof input.source !== 'string' || (n.source.end as number) > input.source.length)) add('source', 'Select a nonempty source passage within the source text.', id);
  }
  for (const n of raw) {
    if (!object(n)) continue;
    if (object(n.source) && typeof input.source === 'string' && Number.isSafeInteger(n.source.start) && Number.isSafeInteger(n.source.end) && typeof n.text === 'string' && n.text !== input.source.slice(n.source.start as number, n.source.end as number)) add('source', 'A bound instruction must exactly match the selected source passage. Unbind it before changing its wording.', typeof n.id === 'string' ? n.id : undefined);
    const id = typeof n.id === 'string' ? n.id : undefined;
    if (Array.isArray(n.prerequisites)) for (const p of n.prerequisites) {
      if (!ids.has(p as string)) add('prerequisites', `Unknown prerequisite: ${String(p)}.`, id);
      if (p === n.id) add('prerequisites', 'A step cannot depend on itself.', id);
    }
    if (object(n.condition)) {
      const decision = raw.find(d => object(d) && d.id === (n.condition as Record<string, unknown>).decisionId);
      if (!object(decision) || decision.type !== 'decision') add('condition', 'The condition must reference an existing decision.', id);
    }
  }
  // Only traverse structurally safe edges. The union includes condition edges.
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    const n = raw.find(x => object(x) && x.id === id);
    if (!object(n)) return false;
    visiting.add(id);
    const edges = [...(Array.isArray(n.prerequisites) ? n.prerequisites.filter(p => typeof p === 'string') : []), ...(object(n.condition) && typeof n.condition.decisionId === 'string' ? [n.condition.decisionId] : [])];
    if (edges.some(p => visit(p))) return true;
    visiting.delete(id); visited.add(id); return false;
  };
  if ([...ids].some(visit)) add('prerequisites', 'Dependencies and conditions must not contain a cycle.');
  return issues;
}
function assertGuide(guide: Guide): void { const errors = validateGuide(guide); if (errors.length) throw new Error(errors.map(e => `${e.nodeId ?? 'Guide'}: ${e.message}`).join(' ')); }
function assertBound(guide: Guide, session: Session): void {
  assertGuide(guide);
  if (session.version !== 1 || session.guideId !== guide.id || session.guideVersion !== guide.version || session.guideHash !== guideHash(guide)) throw new Error('Session and guide versions do not match. Start a new session or restore the matching guide.');
}
export function newSession(guide: Guide): Session {
  assertGuide(guide);
  return { version: 1, guideId: guide.id, guideVersion: guide.version, guideHash: guideHash(guide), answers: {}, completed: [], history: [] };
}
export function getStates(guide: Guide, session: Session): Record<string, StateExplanation> {
  assertBound(guide, session);
  const result: Record<string, StateExplanation> = {};
  const evaluate = (id: string): StateExplanation => {
    if (result[id]) return result[id];
    const node = guide.nodes.find(n => n.id === id)!;
    let value: StateExplanation;
    if (node.condition && !session.answers[node.condition.decisionId]) value = { state: 'unresolved-condition', reason: `Choose Yes or No for “${guide.nodes.find(n => n.id === node.condition!.decisionId)!.text}” first.` };
    else if (node.condition && session.answers[node.condition.decisionId] !== node.condition.answer) value = { state: 'inactive-by-choice', reason: `Not needed because “${guide.nodes.find(n => n.id === node.condition!.decisionId)!.text}” = ${session.answers[node.condition.decisionId] === 'yes' ? 'Yes' : 'No'}.` };
    else {
      const waiting = node.prerequisites.filter(p => !['done', 'inactive-by-choice'].includes(evaluate(p).state));
      if (waiting.length) value = { state: 'blocked-by-prerequisite', reason: `Waiting for ${waiting.map(p => `“${guide.nodes.find(n => n.id === p)!.text}”`).join(' and ')}.` };
      else if (node.type === 'decision') value = session.answers[id] ? { state: 'done', reason: `Your answer: ${session.answers[id] === 'yes' ? 'Yes' : 'No'}.` } : { state: 'available', reason: 'Choose Yes or No. Unknown is not treated as No.' };
      else if (session.completed.includes(id)) value = { state: 'done', reason: 'You explicitly marked this step complete.' };
      else value = { state: 'available', reason: 'Its condition and prerequisites allow this step now.' };
    }
    result[id] = value; return value;
  };
  guide.nodes.forEach(n => evaluate(n.id)); return result;
}
export const states = getStates;
export function isFinished(guide: Guide, session: Session): boolean { return Object.values(getStates(guide, session)).every(s => s.state === 'done' || s.state === 'inactive-by-choice'); }
function closure(guides: Guide[], seeds: string[]): string[] {
  const found = new Set(seeds); let changed = true;
  while (changed) { changed = false; for (const guide of guides) for (const n of guide.nodes) if (!found.has(n.id) && (n.prerequisites.some(p => found.has(p)) || (n.condition && found.has(n.condition.decisionId)))) { found.add(n.id); changed = true; } }
  return [...found];
}
function prepare(guide: Guide, session: Session, transition: Transition): { next: Guide; preview: TransitionPreview } {
  assertBound(guide, session); let affected: string[] = []; let reason: string; let next = guide;
  if (transition.type === 'edit') {
    next = clone(transition.guide); next.version = guide.version + 1; assertGuide(next);
    if (next.id !== guide.id) throw new Error('An edit must preserve the guide ID.');
    const ids = [...new Set([...guide.nodes, ...next.nodes].map(n => n.id))];
    const changed = guide.source !== next.source ? ids : ids.filter(id => canonical(guide.nodes.find(n => n.id === id) ?? null) !== canonical(next.nodes.find(n => n.id === id) ?? null));
    affected = closure([guide, next], changed);
    reason = guide.source !== next.source ? 'Reset because the source document changed; all progress needs review.' : 'Reset because instructions, source bindings or dependencies changed.';
  } else {
    const node = guide.nodes.find(n => n.id === transition.nodeId);
    if (!node || node.type !== (transition.type === 'answer' ? 'decision' : 'action')) throw new Error('Choose a valid node for this change.');
    if (transition.type === 'answer' && transition.answer !== null && !answer(transition.answer)) throw new Error('Answer must be Yes, No or Unknown.');
    if (transition.type === 'answer') { affected = session.answers[node.id] === (transition.answer ?? undefined) ? [] : closure([guide], [node.id]); reason = `Reset because you changed the answer to “${node.text}”.`;  }
    else { affected = closure([guide], [node.id]); reason = `Reset because you unchecked “${node.text}”.`;  }
  }
  return { next, preview: { affected, reset: session.completed.filter(id => affected.includes(id)), retained: session.completed.filter(id => !affected.includes(id)), reason } };
}
export function previewTransition(guide: Guide, session: Session, transition: Transition): TransitionPreview { return prepare(guide, session, transition).preview; }
function record(guide: Guide, session: Session, event: Event, reason: string, reset: string[]): Session {
  if (session.history.length >= MAX_HISTORY_ENTRIES) throw new Error('This session has reached its 5,000-event limit. No change was recorded. Start a new guide session to record more changes.');
  const next = clone(session);
  next.history.push({ event: clone(event), before: { guide: clone(guide), answers: clone(session.answers), completed: [...session.completed] }, reason, reset: [...reset] });
  return next;
}
export function complete(guide: Guide, session: Session, nodeId: string): Session {
  const node = guide.nodes.find(n => n.id === nodeId);
  if (!node || node.type !== 'action' || getStates(guide, session)[nodeId].state !== 'available') throw new Error('Only an available action can be completed.');
  const next = record(guide, session, { type: 'complete', nodeId }, 'You marked this action complete.', []); next.completed.push(nodeId); return next;
}
export function applyTransition(guide: Guide, session: Session, transition: Transition): { guide: Guide; session: Session } {
  const { next: nextGuide, preview } = prepare(guide, session, transition);
  // Identical answers are harmless and do not create an undo entry.
  if (transition.type === 'answer' && !preview.affected.length) return { guide: clone(guide), session: clone(session) };
  const next = record(guide, session, transition, preview.reason, preview.reset);
  next.completed = preview.retained;
  if (transition.type === 'answer') { if (transition.answer === null) delete next.answers[transition.nodeId]; else next.answers[transition.nodeId] = transition.answer; }
  if (transition.type === 'edit') for (const id of Object.keys(next.answers)) if (preview.affected.includes(id) || !nextGuide.nodes.some(n => n.id === id && n.type === 'decision')) delete next.answers[id];
  next.guideVersion = nextGuide.version; next.guideHash = guideHash(nextGuide);
  return { guide: clone(nextGuide), session: next };
}
export function undo(guide: Guide, session: Session): { guide: Guide; session: Session } {
  assertBound(guide, session); const last = session.history.at(-1);
  if (!last) return { guide: clone(guide), session: clone(session) };
  const previous = newSession(last.before.guide);
  previous.answers = clone(last.before.answers); previous.completed = [...last.before.completed]; previous.history = clone(session.history.slice(0, -1));
  return { guide: clone(last.before.guide), session: previous };
}
export function serialize(guide: Guide, session: Session): string {
  assertBound(guide, session);
  if (!Array.isArray(session.history) || session.history.length > MAX_HISTORY_ENTRIES) throw new Error('Progress was not saved: the session exceeds the 5,000-event recovery limit. Start a new guide session.');
  const snapshot = JSON.stringify({ format: 'resumehere-1', guide, session });
  if (snapshot.length > MAX_SNAPSHOT_CHARS) throw new Error('Progress was not saved: this snapshot exceeds the 5,000,000-character recovery limit. Shorten the source or start a new guide session.');
  return snapshot;
}
export type RestoreResult = { ok: true; guide: Guide; session: Session } | { ok: false; error: string };
/** Restore by replaying accepted events from an empty session; never trust stored checkmarks. */
export function restore(serialized: string, expectedGuide?: Guide): RestoreResult {
  try {
    if (typeof serialized !== 'string' || serialized.length > MAX_SNAPSHOT_CHARS) throw new Error('Saved data is too large or not text.');
    const data = JSON.parse(serialized);
    if (!object(data) || data.format !== 'resumehere-1' || !object(data.session)) throw new Error('Unrecognized saved data format.');
    const guide = data.guide as Guide, session = data.session as unknown as Session;
    assertBound(guide, session);
    if (expectedGuide && guideHash(expectedGuide) !== guideHash(guide)) throw new Error('Saved guide does not match the requested version.');
    if (!Array.isArray(session.history) || session.history.length > MAX_HISTORY_ENTRIES) throw new Error('Invalid transition history.');
    let currentGuide = session.history.length ? session.history[0]?.before?.guide : guide;
    let currentSession = newSession(currentGuide);
    for (const entry of session.history) {
      if (!object(entry) || !object(entry.event) || !object(entry.before)) throw new Error('Damaged transition history.');
      if (canonical(entry.before) !== canonical({ guide: currentGuide, answers: currentSession.answers, completed: currentSession.completed })) throw new Error('History contains an inconsistent earlier state.');
      if (entry.event.type === 'complete') currentSession = complete(currentGuide, currentSession, entry.event.nodeId);
      else if (['answer', 'uncomplete', 'edit'].includes(entry.event.type)) ({ guide: currentGuide, session: currentSession } = applyTransition(currentGuide, currentSession, entry.event as Transition));
      else throw new Error('Unknown saved event.');
    }
    if (canonical(currentGuide) !== canonical(guide) || canonical(currentSession) !== canonical(session)) throw new Error('Saved progress failed validation.');
    return { ok: true, guide: clone(guide), session: clone(session) };
  } catch (e) { return { ok: false, error: `Could not restore progress: ${e instanceof Error ? e.message : 'damaged data'}. Keep this data for recovery or explicitly start a new session.` }; }
}
