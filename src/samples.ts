import type { Guide } from './engine';
const meetupSource = 'Save your fictional booking code: DEMO-42.\nPack a notebook.\nHave you reserved a supplies kit?\nCheck in at the community desk after 10:00.\nCollect your reserved kit from the blue shelf.\nPick up a blank activity sheet from the green shelf.\nBring your kit or activity sheet to table 4.';
function bound(source: string, text: string) { const start = source.indexOf(text); return { start, end: start + text.length }; }
export const meetup: Guide = { id: 'fictional-meetup', version: 1, title: 'A morning at the makers meetup', source: meetupSource, nodes: [
{id:'code',type:'action',text:'Save your fictional booking code: DEMO-42.',prerequisites:[],source:bound(meetupSource,'Save your fictional booking code: DEMO-42.')},
{id:'notebook',type:'action',text:'Pack a notebook.',prerequisites:[],source:bound(meetupSource,'Pack a notebook.')},
{id:'kit',type:'decision',text:'Have you reserved a supplies kit?',prerequisites:[],source:bound(meetupSource,'Have you reserved a supplies kit?')},
{id:'checkin',type:'action',text:'Check in at the community desk after 10:00.',prerequisites:['code'],source:bound(meetupSource,'Check in at the community desk after 10:00.')},
{id:'collect',type:'action',text:'Collect your reserved kit from the blue shelf.',prerequisites:['checkin'],condition:{decisionId:'kit',answer:'yes'},source:bound(meetupSource,'Collect your reserved kit from the blue shelf.')},
{id:'sheet',type:'action',text:'Pick up a blank activity sheet from the green shelf.',prerequisites:['checkin'],condition:{decisionId:'kit',answer:'no'},source:bound(meetupSource,'Pick up a blank activity sheet from the green shelf.')},
{id:'table',type:'action',text:'Bring your kit or activity sheet to table 4.',prerequisites:['collect','sheet'],source:bound(meetupSource,'Bring your kit or activity sheet to table 4.')}
]};
const swapSource = 'Pack one book you are happy to exchange.\nWrite a recommendation on a card.\nIs your book a hardback?\nPlace the book on the hardback table.\nPlace the book on the paperback table.\nChoose a new book after placing yours.';
export const bookSwap: Guide = { id:'fictional-books',version:1,title:'The neighborhood book swap',source:swapSource,nodes:[
{id:'pack',type:'action',text:'Pack one book you are happy to exchange.',prerequisites:[]},
{id:'card',type:'action',text:'Write a recommendation on a card.',prerequisites:[]},
{id:'hard',type:'decision',text:'Is your book a hardback?',prerequisites:[]},
{id:'hardback',type:'action',text:'Place the book on the hardback table.',prerequisites:['pack'],condition:{decisionId:'hard',answer:'yes'}},
{id:'paperback',type:'action',text:'Place the book on the paperback table.',prerequisites:['pack'],condition:{decisionId:'hard',answer:'no'}},
{id:'choose',type:'action',text:'Choose a new book after placing yours.',prerequisites:['hardback','paperback']}
].map(n=>({...n,source:bound(swapSource,n.text)})) as Guide['nodes']};
export function blankGuide(): Guide { return {id:crypto.randomUUID(),title:'My new guide',version:1,source:'',nodes:[]}; }
