import { useState } from 'react';
import { Plus, Ruler } from 'lucide-react';
import type { ProjectV2 } from '../domain/projectV2';
import { surfaceLabels, type Surface } from '../domain/model';
import { addSimpleArea, editSimpleArea } from '../domain/simpleAreas';
import { numericInput } from '../domain/validation';
import { ContextDialog } from './ContextDialog';
import './simple-area-entry.css';
export function SimpleAreaEntry({project,onAdded,editId}:{project:ProjectV2;editId?:string;onAdded:(p:ProjectV2,id:string)=>void}) {
  const [open,setOpen]=useState(false),[method,setMethod]=useState<'area'|'dimensions'>('area'),[error,setError]=useState('');
  const zone=project.zones.find(z=>z.id===editId);
  const known=(id:string)=>project.parameters.find(p=>p.id===id)?.value??'';
  const title=zone?'Ubah ukuran area':'Tambah area sederhana';
  const formId=`simple-area-${project.id}`;
  const value=(raw:FormDataEntryValue|null) => {const parsed=numericInput(String(raw??''));if(!parsed.ok||parsed.value==null||parsed.value<=0)throw new Error('Isi ukuran positif yang diketahui.');return parsed.value;};
  return <><button type="button" className="simple-area-trigger" onClick={()=>{setError('');setMethod(zone?.areaMethod.kind==='measured-rectangle'?'dimensions':'area');setOpen(true);}}><Plus size={17} aria-hidden="true"/>{title}</button>
    {open&&<div style={{pointerEvents:'auto'}}><ContextDialog title={title} className="simple-area-dialog" onClose={()=>setOpen(false)} footer={<button className="primary" type="submit" form={formId}>{zone?'Terapkan ukuran':'Tambah area'}</button>}>
      <form id={formId} onSubmit={e=>{e.preventDefault();try {const data=new FormData(e.currentTarget);const input={name:String(data.get('name')??''),surface:String(data.get('surface')) as Surface,...(!project.parcel?{parcelArea:value(data.get('parcelArea'))}:{}),...(method==='area'?{area:value(data.get('area'))}:{length:value(data.get('length')),width:value(data.get('width'))})};if(zone){onAdded(editSimpleArea(project,zone.id,input,()=>crypto.randomUUID()),zone.id);}else{const result=addSimpleArea(project,input,()=>crypto.randomUUID());onAdded(result.project,result.zoneId);}setOpen(false);}catch(cause){setError(cause instanceof Error?cause.message:String(cause));}}}>
        {!project.parcel&&<label>Luas seluruh persil (m²)<input name="parcelArea" inputMode="decimal" required placeholder="Maksimum 200 m²"/><small>Gunakan luas yang diketahui, bukan perkiraan dari bentuk sketsa.</small></label>}
        <label>Nama area<input name="name" defaultValue={zone?.name} required maxLength={120} placeholder="Misalnya halaman atau atap"/></label>
        <label>Jenis permukaan<select name="surface" aria-label="Jenis permukaan" required defaultValue={zone?.surface??""}><option value="" disabled>Pilih permukaan</option>{Object.entries(surfaceLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <div className="simple-area-method" role="group" aria-label="Cara memasukkan ukuran"><button type="button" aria-pressed={method==='area'} onClick={()=>setMethod('area')}>Luas</button><button type="button" aria-pressed={method==='dimensions'} onClick={()=>setMethod('dimensions')}><Ruler size={16} aria-hidden="true"/>Panjang × lebar</button></div>
        {method==='area'?<label>Luas area (m²)<input name="area" defaultValue={zone?known(zone.area.id):""} inputMode="decimal" required placeholder="Luas yang diketahui"/></label>:<div className="simple-area-dimensions"><label>Panjang area (m)<input name="length" defaultValue={zone?.areaMethod.kind==='measured-rectangle'?known(zone.areaMethod.length.id):''} inputMode="decimal" required/></label><label>Lebar area (m)<input name="width" defaultValue={zone?.areaMethod.kind==='measured-rectangle'?known(zone.areaMethod.width.id):''} inputMode="decimal" required/></label></div>}
        <p className="simple-area-note">Bentuk di kanvas hanya sketsa. Luas mengikuti ukuran yang Anda masukkan; bentuk dapat diatur di kanvas.</p>
        {error&&<p role="alert" className="field-error">{error}</p>}
      </form>
    </ContextDialog></div>}
  </>;
}
