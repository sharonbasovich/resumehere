import { useEffect, useRef, type ReactNode } from 'react';
import type { HistoryEntry } from './engine';

// React's autoFocus handles mounting. The HTML attribute lets showModal choose
// the safe action on every later opening while keeping native focus restoration.
export function nativeAutofocus(button: HTMLButtonElement | null) {
 button?.setAttribute('autofocus', '');
}

export function Icon({ name }: { name: 'arrow' | 'turn' | 'check' | 'undo' }) {
 const paths = { arrow: 'M4 12h16m-6-6 6 6-6 6', turn: 'M6 4v10h14m-6-6 6 6-6 6', check: 'm5 12 4 4L19 6', undo: 'M4 9h10a6 6 0 0 1 0 12M4 9l5-5M4 9l5 5' };
 return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}

/** Decorative feedback only: state, focus, saving and Undo never wait for motion. */
export function StateContent({ identity, children, className = '' }: { identity: string; children: ReactNode; className?: string }) {
 const ref = useRef<HTMLDivElement>(null);
 const previous = useRef(identity);
 useEffect(() => {
  if (previous.current === identity) return;
  previous.current = identity;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !ref.current?.animate) return;
  const animation = ref.current.animate([{ opacity: .65, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  // A preference change cancels any in-flight effect to show the final state immediately.
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stop = () => { if (preference.matches) animation.cancel(); };
  preference.addEventListener('change', stop);
  return () => { animation.cancel(); preference.removeEventListener('change', stop); };
 }, [identity]);
 return <div ref={ref} className={className}>{children}</div>;
}

export function describeChange(entry: HistoryEntry): string {
 const event = entry.event;
 const name = (id: string) => entry.before.guide.nodes.find(n => n.id === id)?.text ?? id;
 const answer = (value: string | null | undefined) => value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Unknown';
 if (event.type === 'complete') return `Completed: ${name(event.nodeId)}`;
 if (event.type === 'uncomplete') return `Unchecked: ${name(event.nodeId)}`;
 if (event.type === 'answer') return `Changed “${name(event.nodeId)}” from ${answer(entry.before.answers[event.nodeId])} to ${answer(event.answer)}.`;
 return `Updated instructions for “${event.guide.title}”.`;
}
