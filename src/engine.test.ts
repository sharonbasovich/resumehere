import { describe, expect, it } from 'vitest';
import { MAX_SNAPSHOT_CHARS, MAX_HISTORY_ENTRIES, applyTransition, complete, getStates, guideHash, isFinished, newSession, previewTransition, restore, serialize, undo, validateGuide, type Guide, type GuideNode, type Session } from './engine';
const action = (id: string, prerequisites: string[] = [], condition?: GuideNode['condition']): GuideNode => ({ id, type: 'action', text: `Do ${id}`, prerequisites, ...(condition ? { condition } : {}) });
const fixture = (): Guide => ({ id: 'meetup', title: 'Fictional meetup', version: 1, source: 'Bring a notebook. Reserve a kit. Check in.', nodes: [
  action('notebook'), { id: 'kit', type: 'decision', text: 'Have you reserved a kit?', prerequisites: [] },
  action('reserved', [], { decisionId: 'kit', answer: 'yes' }), action('walkin', [], { decisionId: 'kit', answer: 'no' }), action('checkin', ['reserved', 'walkin']), action('seat', ['checkin'])
] });
const choose = (g: Guide, s: Session, value: 'yes' | 'no' | null) => applyTransition(g, s, { type: 'answer', nodeId: 'kit', answer: value }).session;
const progressed = () => { const g = fixture(); let s = choose(g, newSession(g), 'yes'); for (const id of ['notebook', 'reserved', 'checkin', 'seat']) s = complete(g, s, id); return { g, s }; };
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
describe('validation and literal definitions', () => {
  it('accepts a small original fork/rejoin guide', () => expect(validateGuide(fixture())).toEqual([]));
  it('preserves exact source text and repeated excerpt offsets', () => { const g = fixture(); g.source = 'Do not enter. Do not enter.'; g.nodes[0].source = { start: 14, end: 27 }; g.nodes[0].text = 'Do not enter.'; expect(validateGuide(g)).toEqual([]); expect(g.source.slice(g.nodes[0].source.start, g.nodes[0].source.end)).toBe('Do not enter.'); expect(restore(serialize(g, newSession(g))).ok).toBe(true); });
  it('rejects source bindings whose displayed wording differs from the literal passage', () => { const g = fixture(); g.nodes[0].source = { start: 0, end: 5 }; expect(validateGuide(g).some(x => x.field === 'source' && x.message.includes('exactly match'))).toBe(true); });
  it('rejects duplicate IDs', () => { const g = fixture(); g.nodes.push(action('notebook')); expect(validateGuide(g).some(x => x.field === 'id')).toBe(true); });
  it('rejects missing prerequisites and self references', () => { const g = fixture(); g.nodes[0].prerequisites = ['missing', 'notebook']; expect(validateGuide(g).filter(x => x.field === 'prerequisites').length).toBeGreaterThanOrEqual(2); });
  it('rejects a cycle in prerequisite edges', () => { const g = fixture(); g.nodes[0].prerequisites = ['seat']; g.nodes[2].prerequisites = ['notebook']; expect(validateGuide(g).some(x => x.message.includes('cycle'))).toBe(true); });
  it('detects union cycles involving a condition edge', () => { const g = fixture(); g.nodes[1].prerequisites = ['reserved']; expect(validateGuide(g).some(x => x.message.includes('cycle'))).toBe(true); });
  it('rejects nondecision and missing condition references', () => { for (const decisionId of ['missing', 'notebook']) { const g = fixture(); g.nodes[2].condition!.decisionId = decisionId; expect(validateGuide(g).some(x => x.field === 'condition')).toBe(true); } });
  it('rejects nested and prerequisite-gated decisions explicitly', () => { const g = fixture(); g.nodes[1].condition = { decisionId: 'kit', answer: 'yes' }; expect(validateGuide(g).some(x => x.message.includes('nested'))).toBe(true); });
  it('rejects limits, malformed nodes, blank text, invalid offsets and prototype IDs', () => { const g = fixture(); g.nodes = Array.from({ length: 13 }, (_, i) => action(`a${i}`)); expect(validateGuide(g).some(x => x.message.includes('12'))).toBe(true); const bad = fixture(); bad.nodes[0].source = { start: 0, end: 999 }; bad.nodes[0].text = ' '; bad.nodes[0].id = '__proto__'; expect(validateGuide(bad).length).toBeGreaterThanOrEqual(3); expect(validateGuide(null).length).toBeGreaterThan(0); expect(validateGuide({ ...fixture(), nodes: [null] }).length).toBeGreaterThan(0); });
  it('rejects five decisions, duplicate edges and invalid answer literals', () => { const g = fixture(); for (let i = 0; i < 4; i++) g.nodes.push({ id: `d${i}`, type: 'decision', text: 'Choose?', prerequisites: [] }); g.nodes[0].prerequisites = ['kit', 'kit']; (g.nodes[2].condition as unknown as { answer: string }).answer = 'maybe'; expect(validateGuide(g).some(x => x.message.includes('4 decisions'))).toBe(true); expect(validateGuide(g).some(x => x.message.includes('duplicate prerequisites'))).toBe(true); expect(validateGuide(g).some(x => x.message.includes('yes/no'))).toBe(true); });
});
describe('computed execution and reversible invalidation', () => {
  it('unknown is never No, and independent steps remain available', () => { const g = fixture(), states = getStates(g, newSession(g)); expect(states.notebook.state).toBe('available'); expect(states.reserved.state).toBe('unresolved-condition'); expect(states.walkin.state).toBe('unresolved-condition'); expect(states.checkin.state).toBe('blocked-by-prerequisite'); });
  it.each(['yes', 'no'] as const)('allows fork/rejoin for %s only after active branch completion', value => { const g = fixture(); let s = choose(g, newSession(g), value); const active = value === 'yes' ? 'reserved' : 'walkin', inactive = value === 'yes' ? 'walkin' : 'reserved'; expect(getStates(g, s)[inactive].state).toBe('inactive-by-choice'); expect(() => complete(g, s, 'checkin')).toThrow(); s = complete(g, s, active); expect(getStates(g, s).checkin.state).toBe('available'); });
  it('cannot complete a decision, unknown node, inactive, duplicate or blocked step', () => { const g = fixture(); const s = choose(g, newSession(g), 'yes'); for (const id of ['kit', 'missing', 'walkin', 'seat']) expect(() => complete(g, s, id)).toThrow(); const checked = complete(g, s, 'notebook'); expect(() => complete(g, checked, 'notebook')).toThrow(); });
  it('previews exact completed resets and retained independent work without mutation', () => { const { g, s } = progressed(), before = serialize(g, s); expect(previewTransition(g, s, { type: 'answer', nodeId: 'kit', answer: 'no' })).toMatchObject({ reset: ['reserved', 'checkin', 'seat'], retained: ['notebook'] }); expect(serialize(g, s)).toBe(before); });
  it('choice changes clear descendants and never resurrect stale checks', () => { const { g, s } = progressed(); const changed = choose(g, s, 'no'); expect(changed.completed).toEqual(['notebook']); expect(choose(g, changed, 'yes').completed).toEqual(['notebook']); expect(getStates(g, changed).walkin.state).toBe('available'); });
  it('Unknown transition clears stale branch completions and answer', () => { const { g, s } = progressed(); const unknown = choose(g, s, null); expect(unknown.answers).toEqual({}); expect(unknown.completed).toEqual(['notebook']); expect(isFinished(g, unknown)).toBe(false); });
  it('unchecking a prerequisite clears itself and only its descendants', () => { const { g, s } = progressed(); const result = applyTransition(g, s, { type: 'uncomplete', nodeId: 'checkin' }); expect(result.session.completed).toEqual(['notebook', 'reserved']); expect(getStates(g, result.session).seat.state).toBe('blocked-by-prerequisite'); });
  it('undo restores the entire previous transition exactly', () => { const { g, s } = progressed(); const result = applyTransition(g, s, { type: 'answer', nodeId: 'kit', answer: 'no' }); expect(undo(result.guide, result.session)).toEqual({ guide: g, session: s }); });
  it('undoing completion requires rechecking, and empty undo is harmless', () => { const g = fixture(), s = newSession(g); expect(undo(g, s)).toEqual({ guide: g, session: s }); expect(undo(g, complete(g, s, 'notebook'))).toEqual({ guide: g, session: s }); });
  it('editing a node resets descendants, increments version, and can undo version too', () => { const { g, s } = progressed(), edited = copy(g); edited.nodes[2].text = 'Take your reserved kit from the blue table.'; const result = applyTransition(g, s, { type: 'edit', guide: edited }); expect(result.guide.version).toBe(2); expect(result.session.completed).toEqual(['notebook']); expect(undo(result.guide, result.session)).toEqual({ guide: g, session: s }); });
  it('changed source resets every completion and explicit answer', () => { const { g, s } = progressed(), edited = copy(g); edited.source += ' New arrival time.'; const result = applyTransition(g, s, { type: 'edit', guide: edited }); expect(result.session.completed).toEqual([]); expect(result.session.answers).toEqual({}); });
  it('removed dependency uses old graph closure to reset downstream checks', () => { const { g, s } = progressed(), edited = copy(g); edited.nodes = edited.nodes.filter(n => n.id !== 'reserved'); edited.nodes.find(n => n.id === 'checkin')!.prerequisites = ['walkin']; const result = applyTransition(g, s, { type: 'edit', guide: edited }); expect(result.session.completed).toEqual(['notebook']); });
  it('editing source binding invalidates its action and downstream completion', () => { const { g, s } = progressed(), edited = copy(g); edited.nodes[2].source = { start: 0, end: 5 }; edited.nodes[2].text = edited.source.slice(0, 5); expect(previewTransition(g, s, { type: 'edit', guide: edited }).reset).toEqual(['reserved', 'checkin', 'seat']); });
  it('finish distinguishes inactive branches, unresolved decisions and completed actions', () => { const { g, s } = progressed(); expect(isFinished(g, s)).toBe(true); expect(s.completed).not.toContain('walkin'); expect(getStates(g, s).walkin.reason).toContain('Yes'); expect(isFinished(g, newSession(g))).toBe(false); });
  it('an inactive branch does not skip a separate unknown decision', () => { const g = fixture(); g.nodes.push({ id: 'transport', type: 'decision', text: 'Walking?', prerequisites: [] }, action('walking', [], { decisionId: 'transport', answer: 'yes' })); g.nodes.find(n => n.id === 'checkin')!.prerequisites.push('walking'); let s = choose(g, newSession(g), 'yes'); s = complete(g, s, 'reserved'); expect(getStates(g, s).checkin.state).toBe('blocked-by-prerequisite'); expect(getStates(g, s).walking.state).toBe('unresolved-condition'); });
  it('repeated identical answers produce no history and never reset progress', () => { const { g, s } = progressed(); expect(choose(g, s, 'yes')).toEqual(s); });
  it('all reducers leave frozen caller-owned input untouched', () => { const { g, s } = progressed(), before = serialize(g, s); Object.freeze(g); Object.freeze(s); applyTransition(g, s, { type: 'uncomplete', nodeId: 'seat' }); undo(g, s); expect(serialize(g, s)).toBe(before); });
});
describe('strict persistence recovery', () => {
  it('accepts the payload boundary and refuses larger snapshots before saving', () => {
    const g = fixture(); g.source = '';
    const overhead = serialize(g, newSession(g)).length;
    g.source = 'x'.repeat(Math.floor((MAX_SNAPSHOT_CHARS - overhead) / 2));
    const saved = serialize(g, newSession(g));
    expect(saved.length).toBeLessThanOrEqual(MAX_SNAPSHOT_CHARS);
    expect(saved.length).toBeGreaterThanOrEqual(MAX_SNAPSHOT_CHARS - 1);
    expect(restore(saved).ok).toBe(true);
    g.source += 'x';
    expect(() => serialize(g, newSession(g))).toThrow('not saved');
    expect(restore('x'.repeat(MAX_SNAPSHOT_CHARS + 1)).ok).toBe(false);
  });
  it('refuses oversized event history before mutation or saving', () => {
    const g = fixture(); const first = complete(g, newSession(g), 'notebook');
    const s = newSession(g); s.history = Array(MAX_HISTORY_ENTRIES).fill(first.history[0]);
    expect(() => complete(g, s, 'notebook')).toThrow('5,000-event limit');
    expect(s.completed).toEqual([]);
    s.history.push(first.history[0]);
    expect(() => serialize(g, s)).toThrow('5,000-event recovery limit');
  });
  it('round-trips a fresh typed guide with explicitly undefined optional editor fields', () => { const g = fixture(); g.nodes[0] = { ...g.nodes[0], source: undefined, condition: undefined }; const s = newSession(g); const restored = restore(serialize(g, s), g); expect(restored.ok).toBe(true); if (restored.ok) { expect(restored.guide).toEqual(JSON.parse(JSON.stringify(g))); expect(restored.session).toEqual(s); } });
  it('canonical identity matches JSON omission and null array slots', () => { const g = { ...fixture(), extension: { omitted: undefined, values: [undefined, , null] } }; expect(guideHash(g)).toBe(guideHash(JSON.parse(JSON.stringify(g)))); expect(restore(serialize(g, newSession(g))).ok).toBe(true); });
  it('round-trips event history, choices, checkmarks and guide', () => { const { g, s } = progressed(); expect(restore(serialize(g, s), g)).toEqual({ ok: true, guide: g, session: s }); });
  it('round-trips edits and restored undo without hybrid versions', () => { const { g, s } = progressed(); const edited = copy(g); edited.nodes[2].text += ' Carefully.'; const result = applyTransition(g, s, { type: 'edit', guide: edited }); expect(restore(serialize(result.guide, result.session))).toEqual({ ok: true, ...result }); const undone = undo(result.guide, result.session); expect(restore(serialize(undone.guide, undone.session))).toEqual({ ok: true, ...undone }); });
  it('rejects malformed JSON, wrong format, wrong guide and session version', () => { const { g, s } = progressed(); expect(restore('{')).toMatchObject({ ok: false }); expect(restore('{}')).toMatchObject({ ok: false }); expect(restore(serialize(g, s), { ...g, version: 2 })).toMatchObject({ ok: false }); const data = JSON.parse(serialize(g, s)); data.session.version = 99; expect(restore(JSON.stringify(data))).toMatchObject({ ok: false }); });
  it('rejects injected completions, changed answers, tampered history and missing history', () => { const { g, s } = progressed(); for (const mutate of [
    (x: any) => x.session.completed.push('walkin'), (x: any) => { x.session.answers.kit = 'no'; },
    (x: any) => { x.session.history[0].before.completed = ['notebook']; }, (x: any) => { x.session.history = []; },
    (x: any) => { x.session.history[0].reason = 'Forged'; }, (x: any) => { x.session.history[0].event.type = 'invented'; }
  ]) { const data = JSON.parse(serialize(g, s)); mutate(data); expect(restore(JSON.stringify(data)).ok).toBe(false); } });
  it('rejects fabricated initial checkmarks even with a matching guide hash', () => { const g = fixture(), s = newSession(g); s.completed = ['notebook']; expect(s.guideHash).toBe(guideHash(g)); expect(restore(serialize(g, s))).toMatchObject({ ok: false }); });
});
describe('bounded graph and event-sequence properties', () => {
  it('checks 64 generated DAGs through choices, completion, rollback, undo and persistence', () => {
    for (let seed = 0; seed < 64; seed++) {
      const nodes: GuideNode[] = [{ id: 'kit', type: 'decision', text: 'Use route A?', prerequisites: [] }, action('independent')];
      for (let i = 0; i < 8; i++) { const prerequisites: string[] = []; for (let p = 0; p < i; p++) if (((seed * 13 + i * 7 + p * 11) % 5) === 0) prerequisites.push(`step${p}`); nodes.push(action(`step${i}`, prerequisites, i % 3 === 0 ? { decisionId: 'kit', answer: i % 2 ? 'no' : 'yes' } : undefined)); }
      const g: Guide = { id: `generated${seed}`, title: 'Original generated graph', source: '', version: 1, nodes }; expect(validateGuide(g)).toEqual([]);
      let s = newSession(g);
      for (const value of [null, 'yes', 'no', null, 'yes'] as const) {
        const before = s; const preview = previewTransition(g, s, { type: 'answer', nodeId: 'kit', answer: value });
        s = choose(g, s, value);
        expect(s.completed).toEqual(preview.retained);
        for (const id of preview.reset) expect(s.completed).not.toContain(id);
        if (s.history.length > before.history.length) expect(undo(g, s).session).toEqual(before);
        if (value === null) for (const node of nodes.filter(n => n.condition)) expect(getStates(g, s)[node.id].state).toBe('unresolved-condition');
        for (let pass = 0; pass < 9; pass++) for (const n of nodes) if (n.type === 'action' && getStates(g, s)[n.id].state === 'available') s = complete(g, s, n.id);
        expect(restore(serialize(g, s))).toEqual({ ok: true, guide: g, session: s });
        expect(s.completed).toContain('independent');
        for (const id of s.completed) expect(getStates(g, s)[id].state).toBe('done');
        const target = s.completed.find(id => id !== 'independent');
        if (target) { const change = { type: 'uncomplete' as const, nodeId: target }; const p = previewTransition(g, s, change); const next = applyTransition(g, s, change).session; expect(next.completed).toEqual(p.retained); expect(next.completed).toContain('independent'); expect(undo(g, next).session).toEqual(s); s = next; }
      }
    }
  }, 30_000); // 320 replay-heavy sequences; allow slower CI and concurrent browser QA.
});
