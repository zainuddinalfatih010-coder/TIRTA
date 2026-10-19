import {NavigatorDataPlan} from './NavigatorDataPlan';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Droplets,House,LayoutList,Map,Save,Waves} from 'lucide-react';
import type {ProjectV2} from '../domain/projectV2';
import {navigatorFactRegistry,type NavigatorDestination,type NavigatorFact} from '../domain/navigatorFacts';
import type {NavigatorJourney} from '../domain/navigatorJourney';
import type {TirtaNavigatorState} from './useTirtaNavigator';
import {TirtaOrb} from './TirtaOrb';
import {NavigatorTaskRenderer} from './NavigatorTaskRenderer';
import {SurfacePatterns} from './SurfacePatterns';
import {surfaceLabels} from '../domain/model';
import {visualLabelAnchor} from './labelLayout';
import './navigator.css';
import {navigatorReadinessSummary} from '../domain/navigatorPresentation';
const goals=[{value:'ponding',label:'Air menggenang',icon:Waves},{value:'roof-runoff',label:'Limpasan atap',icon:House},{value:'hard-runoff',label:'Limpasan halaman',icon:Map},{value:'storage',label:'Menampung air hujan',icon:Droplets},{value:'explore',label:'Lihat pilihan',icon:LayoutList}] as const;
const knowledgeChoices=[['connection','Asal dan jalur air'],['site','Kondisi tanah dan lokasi'],['capacity','Kapasitas penanganan'],['cost','Perkiraan biaya'],['area','Ruang yang tersedia']] as const;
export function NavigatorParcelContext({project,focusZoneId}:{project:ProjectV2;focusZoneId?:string}){
 const points=project.parcel?.polygon??project.zones.flatMap(z=>z.polygon);
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=xs.length?Math.min(...xs):0,top=ys.length?Math.min(...ys):0,w=xs.length?Math.max(...xs)-left:1,h=ys.length?Math.max(...ys)-top:1;
 const unit=Math.max(w,h,1),pad=unit*.09,scale=600/unit;
 const mapped=(points:{x:number;y:number}[])=>points.map(p=>`${(p.x-left+pad)*scale},${(p.y-top+pad)*scale}`).join(' ');
 return <figure className="navigator-parcel"><figcaption><Map size={18}/><strong>{project.name}</strong><span>{project.zones.length} zona</span></figcaption>{points.length?<svg viewBox={`0 0 ${(w+pad*2)*scale} ${(h+pad*2)*scale}`} role="img" aria-label={`Persil ${project.name}, ${project.zones.length} zona. Sketsa dari data proyek.`}><defs><SurfacePatterns prefix="navigator-"/></defs>{project.parcel&&<polygon points={mapped(project.parcel.polygon)} fill="#f2f7f7" stroke="#567c8e" strokeWidth={2.4}/>} {project.zones.map(z=>{const center=visualLabelAnchor(z.polygon);return <g key={z.id}><polygon points={mapped(z.polygon)} fill={`url(#navigator-${z.surface})`} stroke={z.id===focusZoneId?'#008db1':'#75939f'} strokeWidth={z.id===focusZoneId?4.8:1.8}/><text x={(center.x-left+pad)*scale} y={(center.y-top+pad)*scale} textAnchor="middle" fontSize={28} fill="#103750" stroke="#ffffff" strokeWidth={2} paintOrder="stroke">{project.zones.indexOf(z)+1}</text></g>;})}</svg>:<div className="navigator-parcel-empty"><Map size={42}/><p>Persil belum dibuat.</p><span>Gunakan luas area atau gambar dari ukuran yang Anda ketahui.</span></div>}<div className="navigator-zone-key">{project.zones.map((z,i)=><span key={z.id}><b>{i+1}</b>{z.name}</span>)}</div><div className="navigator-surface-key">{[...new Set(project.zones.map(z=>z.surface))].filter(s=>s!==null).map(s=><span key={s}>{surfaceLabels[s!]}</span>)}</div></figure>;
}
export function TirtaNavigator({project,navigator,onTool,onProject,onNavigate,scenario}:{project:ProjectV2;navigator:TirtaNavigatorState;onTool:(fact:NavigatorFact)=>void;onProject:(p:ProjectV2)=>void;onNavigate:(d:NavigatorDestination)=>void;scenario:string}){
 const n=navigator,j=n.journey,task=n.task;
 const step=!j.orientation.includes('goal')?'goal':!j.orientation.includes('knowledge')?'knowledge':!j.orientation.includes('method')?'method':j.preferredFamily!=='undecided'&&!j.orientation.includes('priority')?'priority':null;
 const [inventory,setInventory]=useState<string[]>([]),[showData,setShowData]=useState(false),[transitioning,setTransitioning]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null),surface=useRef<HTMLElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const identity=step??task?.id??'data-plan';
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[identity,showData]);
 const receive=(action:()=>void)=>{
 if(timer.current)clearTimeout(timer.current);surface.current?.getAnimations().forEach(animation=>animation.cancel());const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 setTransitioning(true);surface.current?.animate(reduced?[{opacity:1},{opacity:.4},{opacity:1}]:[{opacity:1,transform:'translateY(0) scale(1)',borderRadius:'24px'},{opacity:.12,transform:'translateY(-54px) scale(.9)',borderRadius:'48px'},{opacity:1,transform:'translateY(0) scale(1)',borderRadius:'24px'}],{duration:reduced?100:360,easing:'cubic-bezier(.2,.78,.2,1)'});
 action();timer.current=setTimeout(()=>{setTransitioning(false);heading.current?.focus({preventScroll:true});},reduced?100:360);
 };
 const answer=(value:Partial<NavigatorJourney>)=>receive(()=>n.answer(step!,value));
 const selectedFacts=task?task.factIds.flatMap(id=>n.facts.filter(f=>f.id===id)):[];
 const roofTask=selectedFacts.some(f=>f.key.startsWith('roof'));
 const title=step==='goal'?'Apa yang ingin Anda tangani?':step==='knowledge'?'Data apa yang sudah Anda punya?':step==='method'?'Sudah ada penanganan yang ingin diuji?':step==='priority'?'Apa yang ingin Anda utamakan?':showData||!task?'Rencana data Anda':roofTask?`Atur aliran ${project.zones.find(z=>z.id===selectedFacts[0]?.zoneId)?.name??'atap'}`:task.kind==='field-mission'?'Periksa lokasi ini':selectedFacts.length>1?selectedFacts.every(f=>f.consequence==='comparison')?'Lengkapi biaya dan ruang':'Lengkapi data terkait':selectedFacts[0]?.label??navigatorFactRegistry[selectedFacts[0]!.key].label;
 if(!n.ready)return <p role="status">Membuka progres Navigatorâ€¦</p>;
 return <div className="tirta-navigator">
 <header className="navigator-header"><div className="navigator-identity"><TirtaOrb state={transitioning?'receiving':task?.reasonCode==='repair-state'?'planning':!task?n.facts.some(f=>f.status!=='known'&&f.status!=='not-applicable')?'field-gap':'ready':task.kind==='field-mission'?'field-gap':'idle'}/><div><h1>Navigator</h1><span>{project.name}</span></div></div></header>
 <div className="navigator-layout"><section ref={surface} className="navigator-task-surface" aria-busy={transitioning}>
 <div className="navigator-task-caption">{step?'Kenali kebutuhan Anda':task?.reasonCode==='repair-state'?'Tinjau data yang berubah':task?.kind==='compact-bundle'?navigatorReadinessSummary(selectedFacts).label:task?.kind==='field-mission'?'Misi lapangan':'Langkah berikutnya'}</div>
 <h2 ref={heading} tabIndex={-1}>{title}</h2>
 {showData||!step&&!task?<NavigatorDataPlan onTool={onTool} project={project} scenario={scenario} navigator={n} onNavigate={onNavigate} onRevisit={fact=>{n.revisit(fact);setShowData(false);}}/>:<>
 {step==='goal'&&<div className="navigator-choices">{goals.map(g=><button key={g.value} onClick={()=>answer({intent:g.value})}><g.icon size={23}/><span>{g.label}</span><ArrowRight size={18}/></button>)}</div>}
 {step==='knowledge'&&<><p>Pilih yang sudah tersedia. Anda akan memasukkan datanya pada langkah berikutnya.</p><div className="navigator-knowledge">{knowledgeChoices.map(([id,label])=><label key={id}><input type="checkbox" checked={inventory.includes(id)} onChange={e=>setInventory(e.target.checked?[...inventory,id]:inventory.filter(x=>x!==id))}/><span>{label}</span></label>)}</div><div className="navigator-task-actions"><button className="primary" onClick={()=>answer({knowledge:Object.fromEntries(knowledgeChoices.map(([id])=>[id,inventory.includes(id)?'yes':'unknown']))})}>Lanjutkan<ArrowRight size={18}/></button><button onClick={()=>answer({knowledge:Object.fromEntries(knowledgeChoices.map(([id])=>[id,'unknown']))})}>Belum punya data</button></div></>}
 {step==='method'&&<div className="navigator-choices">{([['tank','Tangki'],['resapan','Sumur / area resapan'],['garden','Rain garden'],['biopori','Biopori'],['undecided','Belum tahu, lihat pilihan']] as const).map(([value,label])=><button key={value} onClick={()=>answer({preferredFamily:value})}><Droplets size={22}/><span>{label}</span><ArrowRight size={18}/></button>)}</div>}
 {step==='priority'&&<div className="navigator-choices">{([['water','Sisa limpasan lebih sedikit'],['cost','Biaya lebih rendah'],['land','Ruang lebih sedikit'],['storage','Air untuk digunakan kembali'],['undecided','Belum ada prioritas']] as const).map(([value,label])=><button key={value} onClick={()=>answer({comparisonPriority:value})}><span>{label}</span><ArrowRight size={18}/></button>)}</div>}
 {!step&&task&&<><NavigatorTaskRenderer key={task.id} task={task} facts={selectedFacts} preferredFamily={j.preferredFamily} project={project} onTool={onTool} onProject={p=>receive(()=>onProject(p))} onDefer={()=>receive(n.defer)}/>{selectedFacts[0]?.why&&<details className="navigator-why"><summary>Mengapa TIRTA menanyakan ini?</summary><p className="navigator-task-reason">{selectedFacts[0].why}</p></details>}</>}
 </>}
 <footer className="navigator-task-footer"><button onClick={()=>{n.reorient();setShowData(false);}}>Ubah kebutuhan</button><span role="status"><Save size={15}/>{n.error?n.error:n.saving?'Menyimpan progresâ€¦':j.orientation.length?'Progres tersimpan':'Progres disimpan setelah jawaban pertama'}</span>{(step||task)&&<button onClick={()=>setShowData(!showData)}>{showData?'Kembali ke tugas':'Buka rencana data'}</button>}</footer>
 </section><aside className="navigator-context"><NavigatorParcelContext project={project} focusZoneId={selectedFacts.find(f=>f.zoneId)?.zoneId??j.focusZoneId}/><dl className="navigator-progress">{[['parcel','Persil'],['rainfall','Hujan'],['connection','Hubungan air'],['capacity','Kapasitas']] .map(([group,label])=>{const summary=navigatorReadinessSummary(n.facts.filter(f=>f.group===group));return <div key={group}><dt>{label}</dt><dd title={summary.detail||undefined}>{summary.label}</dd></div>;})}</dl><button className="navigator-advanced" onClick={()=>onNavigate(task?.returnDestination??'studio')}>Buka ruang kerja langsung<ArrowRight size={18}/></button></aside></div>
 </div>;
}

