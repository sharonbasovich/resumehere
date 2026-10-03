import {readdir,readFile,writeFile} from 'node:fs/promises';
const packages=[];
for(const dir of await readdir('node_modules')){
 if(dir.startsWith('.'))continue;
 if(dir.startsWith('@'))for(const sub of await readdir('node_modules/'+dir))packages.push('node_modules/'+dir+'/'+sub);
 else packages.push('node_modules/'+dir);
}
const records=[];let notices='THIRD-PARTY NOTICES\nGenerated from the pinned installed dependency tree. Original ResumeHere code: MIT.\n\n';
for(const dir of packages){try{
 const p=JSON.parse(await readFile(dir+'/package.json','utf8'));records.push({name:p.name,version:p.version,license:p.license??'See package notice',repository:p.repository??null});
 const names=(await readdir(dir)).filter(n=>/^(licen[sc]e|copying|notice)(\.|$)/i.test(n));
 for(const name of names){try{notices+='\n===== '+p.name+'@'+p.version+' / '+name+' =====\n'+await readFile(dir+'/'+name,'utf8')+'\n';}catch{}}
}catch{}}
records.sort((a,b)=>a.name.localeCompare(b.name));
await writeFile('docs/dependency-provenance.json',JSON.stringify(records,null,2)+'\n');
await writeFile('THIRD-PARTY-NOTICES.txt',notices);
console.log('Recorded '+records.length+' installed packages and available bundled license notices.');
