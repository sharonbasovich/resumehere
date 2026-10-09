import { useRef } from 'react';
import type { GuideNode } from './engine';

/** Keep invalid draft edges visible until the author explicitly repairs them. */
export function ReferenceFields({node, nodes, step, referenceName, onChange}: {
 node: GuideNode;
 nodes: GuideNode[];
 step: number;
 referenceName: (id: string) => string;
 onChange: (change: Partial<GuideNode>) => void;
}) {
 const missingPrerequisites = node.prerequisites.filter(id => !nodes.some(n => n.id === id));
 const firstPrerequisite = useRef<HTMLInputElement>(null);
 const gate = useRef<HTMLSelectElement>(null);
 const missingChoice = node.condition && !nodes.some(n => n.id === node.condition!.decisionId && n.type === 'decision');
 const prerequisiteHelp = 'prerequisite-help-'+node.id;
 const conditionHelp = 'condition-help-'+node.id;
 const missingLabel = (kind: string, id: string) => `Missing ${kind}: ${referenceName(id)}`;
 return <>
  <fieldset aria-describedby={missingPrerequisites.length ? prerequisiteHelp : undefined}>
   <legend>Wait for these steps</legend>
   {missingPrerequisites.length > 0 && <div className="reference-repair">
    <p id={prerequisiteHelp}>Uncheck a missing step to stop waiting for it. To replace it, also check the step you want to wait for. Nothing is removed automatically.</p>
    {missingPrerequisites.map(id => <label className="check-label" key={id}>
     <input type="checkbox" checked aria-describedby={prerequisiteHelp} onChange={() => {onChange({prerequisites:node.prerequisites.filter(p => p !== id)});(firstPrerequisite.current ?? gate.current)?.focus();}}/>
     <span>{missingLabel('step',id)}</span>
    </label>)}
   </div>}
   {nodes.filter(n => n.id !== node.id).map((n,index) => <label className="check-label" key={n.id}>
    <input ref={index === 0 ? firstPrerequisite : undefined} type="checkbox" checked={node.prerequisites.includes(n.id)} onChange={e => onChange({prerequisites:e.target.checked ? [...node.prerequisites,n.id] : node.prerequisites.filter(id => id !== n.id)})}/>
    <span>{n.text || 'Untitled '+n.type}</span>
   </label>)}
  </fieldset>
  <label htmlFor={'gate-'+node.id}>Only needed when</label>
  {missingChoice && <p className="reference-repair" id={conditionHelp}><strong>{missingLabel('choice',node.condition!.decisionId)}</strong>. Select an existing choice to keep a condition, or choose “Always needed” to remove the condition. Reassigning keeps the required answer.</p>}
  <select ref={gate} id={'gate-'+node.id} aria-invalid={!!missingChoice} aria-describedby={missingChoice ? conditionHelp : undefined} value={node.condition?.decisionId ?? ''} onChange={e => onChange({condition:e.target.value ? {decisionId:e.target.value,answer:node.condition?.answer ?? 'yes'} : undefined})}>
   {missingChoice && <option disabled value={node.condition!.decisionId}>{missingLabel('choice',node.condition!.decisionId)}</option>}
   <option value="">Always needed</option>
   {nodes.filter(n => n.type === 'decision').map(n => <option key={n.id} value={n.id}>{n.text || 'Untitled choice'}</option>)}
  </select>
  {node.condition && <label className="inline-label">Answer<select aria-label={'Required answer for step '+step} value={node.condition.answer} onChange={e => onChange({condition:{...node.condition!,answer:e.target.value as 'yes'|'no'}})}><option value="yes">Yes</option><option value="no">No</option></select></label>}
 </>;
}
