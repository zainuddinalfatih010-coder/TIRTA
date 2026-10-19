import { unreviewedReceivingSite } from '../domain/siteEvidence';
import { useState } from 'react';
import type { ProjectV2 } from '../domain/projectV2';
import type { ComponentVariant } from '../domain/intervention-contract';
import { emptyInterventionEvidence } from '../domain/scientificContract';
import { componentEditorValues } from './productionBridge';
import { SourceField } from './ProductionControls';
import { TextField } from './ScientificInputs';
import { X, Plus, MapPin } from 'lucide-react';
import type { SelectionRole } from './TreatmentComposer';
export const taskQuestions: Record<string,string> = {
  source:'Air dari area mana yang akan ditangani?', installation:'Di mana penanganan ini akan dipasang?',
  via:'Bagaimana air mencapai penanganan ini?', catchmentReviewed:'Apakah jalur ini melayani seluruh area sumber?',
  sharedSourceMode:'Bagaimana sumber bersama ini digunakan?', allocationNote:'Penanganan mana yang menerima air lebih dahulu?',
  connection:'Ke mana air yang meluap akan mengalir?', capacity:'Berapa kapasitas yang tersedia untuk hujan ini?',
  capacityBasis:'Apa dasar kinerja kapasitas pada hujan ini?', performanceMethod:'Bagaimana dan kapan kapasitas ini diukur?',
  soil:'Berapa kemampuan resapan tanah yang diketahui?', soilEvidence:'Dari mana angka resapan tanah ini berasal?',
  soilMeasurement:'Bagaimana dan kapan tanah ini diukur?', groundwater:'Apakah kondisi air tanah mendukung resapan?',
  standard:'Apakah persyaratan setempat sudah ditinjau?', condition:'Bagaimana kondisi instalasi yang sudah ada?',
  maintenance:'Bagaimana penanganan akan dipelihara?', field:'Apakah lokasi pemasangan sudah diperiksa?',
  media:'Media dan tanaman apa yang direncanakan?', operation:'Bagaimana air tangki digunakan dan dikosongkan?',
  cost:'Berapa perkiraan biaya penanganan ini?', area:'Berapa luas yang dipakai pemasangannya?',
  routeNote:'Apa catatan jalur airnya, jika diperlukan?', holeDimensions:'Berapa ukuran lubang yang direncanakan?', nominal:'Berapa ukuran nominal tangki, jika diketahui?', holes:'Bagaimana rencana lubang Biopori?', name:'Apa nama penanganan ini?',
  budget:'Berapa batas biaya proyek?', land:'Berapa ruang yang tersedia untuk proyek?', allocatedSpace:'Berapa ruang yang dialokasikan?',
};
export const taskField = (field:string) => ({capacitySource:'capacity',performanceContext:'capacityBasis',soilOrigin:'soilEvidence',soilSource:'soilEvidence',soilMethod:'soilMeasurement',soilDate:'soilMeasurement',nominalSource:'nominal',holeSource:'holes'} as Record<string,string>)[field]??field;
/** Unanswered remains UNKNOWN internally; the menu only lists real answers. */
function ChoiceField({name,label,value,choices}:{name:string;label:string;value:string;choices:Record<string,string>}) {
  return <label>{label}<select aria-label={label} name={name} defaultValue={value}><option value="unknown" hidden></option>{Object.entries(choices).filter(([key])=>key!=='unknown').map(([key,text])=><option key={key} value={key}>{text}</option>)}</select></label>;
}
export function GuidedTreatmentFields({project,c,scenario,task,targets,site,mode,name,setTargets,setSite,setMode,setName,onPick,conflicts,invalidOverflow,recipients,soilStale}: {
  project:ProjectV2;c:ComponentVariant;scenario:string;task:string;targets:string[];site:string;mode:NonNullable<ComponentVariant['treatment']>['sharedSourceMode'];name:string;
  setTargets:(v:string[])=>void;setSite:(v:string)=>void;setMode:(v:NonNullable<ComponentVariant['treatment']>['sharedSourceMode'])=>void;setName:(v:string)=>void;
  onPick:(role:SelectionRole)=>void;conflicts:ComponentVariant[];invalidOverflow:boolean;recipients:ComponentVariant[];soilStale:boolean;
}) {
  const values=componentEditorValues(project,c.id,scenario)!;
  const savedEvidence=project.science?.interventions[c.id]??emptyInterventionEvidence();
  const siteChanged=c.family!=='storage'&&site!==(c.treatment?.installationZoneId??'');
  const e=siteChanged?unreviewedReceivingSite(savedEvidence):savedEvidence,basis=e.performance[scenario];
  const [soilOriginChoice,setSoilOriginChoice]=useState({site,origin:e.soilInfiltration.origin});
  const soilOrigin=soilOriginChoice.site===site?soilOriginChoice.origin:e.soilInfiltration.origin;
  const [soilChoice,setSoilChoice]=useState({site,use:!!e.soilReference&&!soilStale});
  const useSoil=soilChoice.site===site&&soilChoice.use;
  const [groundwaterChoice,setGroundwaterChoice]=useState({site,value:e.groundwaterAssessment});
  const groundwater=groundwaterChoice.site===site?groundwaterChoice.value:e.groundwaterAssessment;
  const [origin,setOrigin]=useState(basis?.origin??'unknown');
  const soil=project.science?.surfaces[site]?.soil.infiltration;
  const overflow=e.overflow.kind==='zone'||e.overflow.kind==='intervention'?`${e.overflow.kind}:${e.overflow.id}`:e.overflow.kind;
  const numberOrigins={unknown:'Belum diketahui',measured:'Pengukuran',user_supplied:'Data / asumsi saya',literature_guidance:'Acuan literatur',derived:'Turunan dengan dasar',legacy_fixture:'Angka contoh lama'};
  const taskSection=(id:string,children:React.ReactNode)=><fieldset key={`${id}:${['capacityBasis','performanceMethod','soil','soilEvidence','soilMeasurement','groundwater','standard','condition','maintenance','field'].includes(id)?site:'stable'}`} className="guided-fields" data-task={id} hidden={task!==id}>{children}</fieldset>;
  return <>
    {taskSection('source',<><div className="treatment-source-chips">{targets.map(id=><span key={id}><span>{project.zones.find(z=>z.id===id)?.name??'Zona terhapus'}</span><button type="button" aria-label={`Lepas sumber ${project.zones.find(z=>z.id===id)?.name}`} onClick={()=>setTargets(targets.filter(x=>x!==id))}><X size={14}/></button></span>)}</div><button type="button" className="role-choice" data-role-choice="source" onClick={()=>onPick(c.family==='permeable'?'conversion':'source')}><Plus size={17}/>{targets.length?'Tambah sumber':'Pilih sumber limpasan'}</button></>)}
    {taskSection('installation',<><button type="button" className="role-choice" data-role-choice="installation" onClick={()=>onPick('installation')}><MapPin size={17}/>{project.zones.find(z=>z.id===site)?.name??'Pilih lokasi penerapan'}</button>{!(c.family==='infiltration'&&c.infiltrationType==='biopori')&&<button type="button" className="text-button" onClick={()=>setSite('')}>Lokasi belum diketahui</button>}{c.family==='infiltration'&&c.infiltrationType==='biopori'&&<small>Biopori dapat dipasang pada semua jenis permukaan kecuali Atap. Sumber air boleh dari zona lain.</small>}</>)}
    {taskSection('via',<ChoiceField name="via" label="Jalur penyaluran" value={project.science?.connections.find(l=>l.candidateId===c.id)?.via??'unknown'} choices={{unknown:'Belum diketahui','gutter-downpipe':'Talang / pipa turun',edge:'Tepi permukaan',drain:'Saluran',other:'Jalur lain'}}/>)}
    {taskSection('routeNote',<TextField name="connectionSource" label="Catatan jalur air" value={project.science?.connections.find(l=>l.candidateId===c.id)?.source}/>)}
    {taskSection('catchmentReviewed',<><label className="check-line"><input type="checkbox" name="catchmentReviewed" defaultChecked={c.treatment?.catchmentReviewed===true}/>Jalur ini melayani seluruh area sumber yang dipilih</label><small>Jika talang hanya melayani sebagian atap, pilih zona tangkapan dengan luas yang sesuai.</small></>)}
    {taskSection('sharedSourceMode',<><small>{conflicts.map(x=>x.name).join(', ')} juga memakai sumber ini.</small><label>Penggunaan sumber<select value={mode} onChange={ev=>setMode(ev.target.value as typeof mode)}><option value="unresolved" hidden></option><option value="alternative">Alternatif — tidak digunakan bersama</option><option value="ledger">Berurutan — memakai sisa air</option><option value="parallel">Pembagian paralel — belum didukung</option></select></label></>)}
    {taskSection('allocationNote',<TextField name="allocationNote" label="Dasar urutan penanganan" value={c.treatment?.allocationNote}/>)}
    {taskSection('connection',<>{invalidOverflow&&<small className="field-error">Tujuan sebelumnya nonaktif atau dihapus; hubungan lama tidak diganti otomatis.</small>}<ChoiceField name="overflow" label="Tujuan luapan" value={overflow} choices={{unknown:'Belum diketahui',drainage:'Saluran',outside:'Keluar persil',...Object.fromEntries(project.zones.map(z=>[`zone:${z.id}`,z.name])),...Object.fromEntries(recipients.map(x=>[`intervention:${x.id}`,x.name])),...(invalidOverflow?{[overflow]:'Tujuan sebelumnya perlu diperiksa'}:{})}}/><TextField name="overflowSource" label="Catatan luapan" value={'note' in e.overflow?e.overflow.note:''}/></>)}
    {taskSection('capacity',<SourceField name="capacity" label={c.family==='storage'?'Tampungan tersedia per kejadian':'Air yang dapat diresapkan'} unit="m³/event" initial={values.capacity}/>)}
    {taskSection('capacityBasis',<><label>Dasar kinerja<select key={basis?.origin??'unknown'} name="capacityBasis" defaultValue={basis?.origin??'unknown'} onChange={ev=>setOrigin(ev.target.value as typeof origin)}><option value="unknown" hidden></option><option value="user-entered">Asumsi saya untuk pra-perencanaan</option><option value="measured">Pengukuran kinerja</option><option value="design-declared">Deklarasi desain</option><option value="literature-guided">Acuan yang sesuai</option></select></label><TextField name="capacityBasisSource" label="Alasan / acuan (untuk asumsi)" value={basis?.source}/><small>Tinjauan diterapkan pada angka dan hujan yang sedang ditampilkan.</small></>)}
    {taskSection('performanceMethod',<><TextField name="performanceMethod" label="Metode pengukuran" value={basis?.method}/><label>Tanggal pengukuran<input name="performanceDate" type="date" defaultValue={basis?.date??''}/></label><small>{origin==='measured'?'Diperlukan untuk kinerja terukur.':'Tidak diperlukan bila kinerja bukan hasil pengukuran.'}</small></>)}
    {c.family!=='storage'&&<>
      {taskSection('soil',<>{soil&&soil.value!==null&&<><input type="hidden" name="soilChoicePresent" value="yes"/><label className="check-line"><input name="useZoneSoil" type="checkbox" checked={useSoil} disabled={soilStale} onChange={ev=>setSoilChoice({site,use:ev.target.checked})}/>Gunakan data {project.zones.find(z=>z.id===site)?.name}: {soil.value} mm/jam</label>{useSoil&&<TextField name="soilConfirmation" label="Mengapa data ini berlaku di lokasi pemasangan?" value={e.soilReference?.confirmation}/>}</>}{!useSoil&&<label>Resapan tanah (mm/jam)<input name="soil" type="number" min="0" step="any" defaultValue={e.soilInfiltration.value??''} placeholder="Belum diketahui"/></label>}{soilStale&&<small className="field-error">Data tanah berubah; konfirmasikan kembali.</small>}</>)}
      {taskSection('soilEvidence',<><label>Dasar angka<select name="soilOrigin" value={soilOrigin} onChange={ev=>setSoilOriginChoice({site,origin:ev.target.value as typeof soilOrigin})}><option value="unknown" hidden></option>{Object.entries(numberOrigins).filter(([v])=>v!=='unknown').map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><TextField name="soilSource" label="Sumber / alasan angka resapan" value={e.soilInfiltration.source}/></>)}
      {taskSection('soilMeasurement',<><TextField name="soilMethod" label="Metode pengukuran tanah" value={e.soilInfiltration.method}/><label>Tanggal pengukuran tanah<input name="soilDate" type="date" defaultValue={e.soilInfiltration.date}/></label></>)}
        {taskSection('groundwater',<><label>Kesesuaian terhadap kondisi air tanah<select name="groundwaterAssessment" aria-label="Kesesuaian terhadap kondisi air tanah" value={groundwater} onChange={ev=>setGroundwaterChoice({site,value:ev.target.value as typeof groundwater})}><option value="unknown" hidden></option><option value="suitable">Dinyatakan sesuai</option><option value="unsuitable">Dinyatakan tidak sesuai</option><option value="not-applicable">Tidak berlaku, dengan dasar</option></select></label><div hidden={groundwater==='unknown'}><TextField name="groundwaterBasis" label="Dasar tinjauan air tanah" value={e.groundwaterBasis}/></div></>)}
      {taskSection('standard',<><ChoiceField name="standardReview" label="Persyaratan setempat" value={e.localStandardReview} choices={{unknown:'Belum ditinjau',reviewed:'Sudah ditinjau',failed:'Tidak memenuhi tinjauan'}}/><TextField name="standardBasis" label="Dasar tinjauan" value={e.localStandardBasis}/></>)}
    </>}
    {taskSection('condition',<ChoiceField name="condition" label="Kondisi instalasi" value={e.condition} choices={{unknown:'Belum diketahui / belum dipasang',maintained:'Terawat',clogged:'Tersumbat',damaged:'Rusak'}}/>)}
    {taskSection('maintenance',<TextField name="maintenance" label="Rencana pemeliharaan" value={e.maintenance}/>)}
    {taskSection('field',<><ChoiceField name="fieldVerified" label="Pemeriksaan lokasi" value={e.fieldVerified===null?'unknown':e.fieldVerified?'yes':'no'} choices={{unknown:'Belum diketahui',yes:'Sudah, dengan catatan',no:'Belum'}}/><TextField name="verificationSource" label="Catatan pemeriksaan" value={e.verificationSource}/></>)}
    {c.family==='rain-garden'&&taskSection('media',<><TextField name="media" label="Media / tanah" value={e.media}/><TextField name="vegetation" label="Tanaman" value={e.vegetation}/></>)}
    {c.family==='storage'&&<>
      {taskSection('nominal',<><label>Kapasitas nominal tangki (m³)<input name="nominal" type="number" min="0" step="any" defaultValue={e.nominalTankCapacity.value??''} placeholder="Belum diketahui"/></label><TextField name="nominalSource" label="Dasar ukuran tangki" value={e.nominalTankCapacity.source}/></>)}
      {taskSection('operation',<><ChoiceField name="waterUse" label="Penggunaan air" value={c.waterUse??'unknown'} choices={{unknown:'Belum diputuskan',irrigation:'Penyiraman',cleaning:'Pembersihan nonkonsumsi',toilet:'Toilet nonkonsumsi',temporary:'Tampungan sementara'}}/><ChoiceField name="drawdown" label="Ruang untuk hujan berikutnya" value={c.drawdown??'unknown'} choices={{unknown:'Belum direncanakan',planned:'Penggunaan / pengosongan terencana',unavailable:'Belum ada cara pengosongan'}}/></>)}
    </>}
    {c.family==='infiltration'&&c.infiltrationType==='biopori'&&taskSection('holes',<><label>Jumlah lubang<input name="holeCount" type="number" min="1" step="1" defaultValue={e.biopori?.count??''}/></label><TextField name="holeSource" label="Dasar rencana fisik" value={e.biopori?.source}/><small>Jumlah lubang tidak menetapkan kapasitas resapan.</small></>)}
    {c.family==='infiltration'&&c.infiltrationType==='biopori'&&taskSection('holeDimensions',<><label>Diameter lubang (cm)<input name="holeDiameter" type="number" min="0" step="any" defaultValue={e.biopori?.diameterCm??''}/></label><label>Kedalaman lubang (cm)<input name="holeDepth" type="number" min="0" step="any" defaultValue={e.biopori?.depthCm??''}/></label><small>Ukuran ini tidak menetapkan kapasitas resapan.</small></>)}
    {taskSection('cost',<SourceField name="cost" label="Biaya" unit="Rp" initial={values.cost}/>)}
    {taskSection('area',<SourceField name="area" label="Ruang terpakai" unit="m²" initial={values.area}/>)}
    {taskSection('name',<label>Nama penanganan<input value={name} onChange={ev=>setName(ev.target.value)} maxLength={120}/></label>)}
  </>;
}
