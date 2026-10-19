import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, FileCode2, FolderDown, Info } from 'lucide-react';
import type { ProjectV2 } from '../domain/projectV2';
import { alternativeSearch } from './productionBridge';
import { buildProjectReport } from '../report/projectReport';
import { reportHtml, reportFilename, downloadBlob } from '../report/reportHtml';
import { ContextDialog } from './ContextDialog';
import '../report/report.css';
import './project-report.css';

export function ProjectReportDialog({project,scenario,onBackup,onClose}:{project:ProjectV2;scenario:string;onBackup:()=>Promise<string>;onClose:()=>void}) {
  const [includeSources,setIncludeSources]=useState(false);
  const [detail,setDetail]=useState<'summary'|'detailed'>('summary');
  const hasSelected=!!project.selectedPlan?.definition.components.some(c=>c.enabled);
  const hasActive=project.components.some(c=>c.enabled&&c.family!=='permeable');
  const [packageChoice,setPackageChoice]=useState(hasSelected ? 'selected' : hasActive ? 'active' : '');
  const [comparisonPlanId,setComparisonPlanId]=useState('');
  const search=useMemo(()=>alternativeSearch(project,scenario),[project,scenario]);
  const exportRows=search.rows.filter(a=>a.plan.components.some(c=>c.enabled));
  const effectiveChoice=packageChoice || (exportRows[0] ? `alternative:${exportRows[0].id}` : '');
  const canExport=!!effectiveChoice;
  const planScope=effectiveChoice==='selected' ? 'selected' : effectiveChoice==='active'||!effectiveChoice ? 'active' : 'alternative';
  const planId=planScope==='alternative' ? effectiveChoice.slice('alternative:'.length) : undefined;
  const report=useMemo(()=>buildProjectReport(project,scenario,{includeSources,detail,planScope,planId,comparisonPlanId}),[project,scenario,includeSources,detail,planScope,planId,comparisonPlanId]);
  const scopeLabel=report.state==='draft'?'Laporan draf':report.state==='alternative'?'Laporan alternatif':report.state==='stale'?'Rencana lama · belum ditinjau':'Rencana pilihan';
  const pdfLabel=report.state==='draft'?'Unduh PDF draf':report.state==='alternative'?'Unduh PDF alternatif':report.state==='stale'?'Unduh PDF rencana lama':'Unduh PDF rencana';
  const selectedNames=project.selectedPlan?.definition.components.filter(c=>c.enabled).map(c=>c.name).join(' + ') || 'Tanpa intervensi';
  const activeNames=project.components.filter(c=>c.enabled).map(c=>c.name).join(' + ') || 'Tanpa intervensi';
  const differs=!!project.selectedPlan && (JSON.stringify(project.selectedPlan.definition.components.filter(c=>c.enabled).map(c=>c.id).sort())!==JSON.stringify(project.components.filter(c=>c.enabled).map(c=>c.id).sort()));
  const signature=JSON.stringify([report.title,report.inputFingerprint,report.sections]);
  const currentSignature=useRef(signature);
  useEffect(()=>{currentSignature.current=signature;},[signature]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const filename=project.name+'-'+report.state+'-'+(detail==='summary'?'ringkasan':'rincian')+'-'+(includeSources ? 'dengan-sumber' : 'tanpa-sumber');
  const exportPdf=async()=>{
    setBusy(true);setError('');
    try { const {reportPdfBlob}=await import('../report/reportPdf');const blob=await reportPdfBlob(report);if(currentSignature.current!==signature)throw new Error('Data proyek berubah saat PDF disiapkan. Coba lagi untuk memakai data terbaru.');await downloadBlob(blob,reportFilename(filename,'pdf')); }
    catch(cause) { setError('PDF belum dapat dibuat. '+(cause instanceof Error ? cause.message : '')+' Anda tetap dapat mengunduh laporan HTML atau cadangan.'); }
    finally { setBusy(false); }
  };
  const backup=async()=>{setError('');setBusy(true);try {await downloadBlob(new Blob([await onBackup()],{type:'application/json'}),reportFilename(project.name,'tirta.json'));}catch(cause){setError(String(cause));}finally{setBusy(false);}};
  return <ContextDialog title={scopeLabel} onClose={()=>{if(!busy)onClose();}} className="project-report-dialog" footer={<div className="report-export-actions">
    <button className="primary" disabled={busy||!canExport} onClick={()=>void exportPdf()}><FileText size={18} aria-hidden="true"/>{busy ? 'Menyiapkan…' : pdfLabel}</button>
    <button disabled={busy} onClick={()=>void backup()}><FolderDown size={18} aria-hidden="true"/>Cadangan proyek</button>
    <button className="report-html-action" disabled={busy||!canExport} onClick={()=>void downloadBlob(new Blob([reportHtml(report)],{type:'text/html;charset=utf-8'}),reportFilename(filename,'html')).catch(cause=>setError(String(cause)))}><FileCode2 size={16} aria-hidden="true"/>Laporan HTML</button>
  </div>}>
    <div className="report-controls">
      <p className="report-scope-status" role="status">{report.status}</p>
      <div className="report-detail-segments" role="group" aria-label="Isi laporan">
        <button aria-pressed={detail==='summary'} disabled={busy} onClick={()=>setDetail('summary')}>Ringkasan</button>
        <button aria-pressed={detail==='detailed'} disabled={busy} onClick={()=>setDetail('detailed')}>Laporan rinci</button>
      </div>
      <div className="report-scope-controls">
        <label className="report-package-label">Paket dalam laporan<select aria-label="Paket dalam laporan" value={effectiveChoice} disabled={busy||!canExport} onChange={e=>{setPackageChoice(e.target.value);setComparisonPlanId('');}}>
          {hasSelected && <option value="selected">Rencana pilihan: {selectedNames}</option>}
          {hasActive && <option value="active">Draf aktif: {activeNames}</option>}
          {exportRows.length>0 && <optgroup label="Satu alternatif yang ditinjau">{exportRows.map(a=><option key={a.id} value={`alternative:${a.id}`}>{a.name}: {a.description}</option>)}</optgroup>}
        </select></label>
        <label className="report-source-switch"><span>Sertakan sumber</span><input type="checkbox" role="switch" aria-label="Sumber laporan" checked={includeSources} disabled={busy} onChange={e=>setIncludeSources(e.target.checked)}/></label>
      </div>
      <label className="report-comparator-label">Alternatif pembanding<select aria-label="Alternatif pembanding" value={comparisonPlanId} disabled={busy || !search.rows.length} onChange={e=>setComparisonPlanId(e.target.value)}><option value="">Tanpa pembanding</option>{search.rows.filter(a=>a.id!==planId).map(a=><option key={a.id} value={a.id}>{a.name}: {a.description}</option>)}</select></label>
      {differs && <p className="report-export-note" role="status"><Info size={15} aria-hidden="true"/>Rencana pilihan berbeda dari intervensi aktif. Pilih paket yang akan dilaporkan.</p>}
      <p className="report-content-note">{detail==='summary' ? 'Hasil, penanganan, hujan, serta asumsi penting.' : 'Ringkasan dan rincian input, kondisi lokasi, serta alur perhitungan.'} {includeSources ? 'Sumber disertakan.' : 'Tanpa daftar sumber; asumsi penting tetap disertakan.'}</p>
    </div>
    {error && <p role="alert" className="report-export-error">{error}</p>}
    {busy && <p role="status" className="sr-only">Menyiapkan berkas di perangkat ini.</p>}
    <div className="report-export-choice-note" aria-label="Isi berkas yang akan dibuat">
      <strong>{detail==='summary'?'Ringkasan rencana':'Laporan rinci'}</strong>
      <span>{report.sections.length} bagian laporan · {includeSources?'dengan daftar sumber':'tanpa daftar sumber'}</span>
    </div>
  </ContextDialog>;
}
