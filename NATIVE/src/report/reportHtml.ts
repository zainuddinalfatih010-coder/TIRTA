import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { ProjectReport, ReportBlock } from './projectReport';
import { number, currency } from './projectReport';
import { escapeXml as esc } from './reportFigures';
import styles from './report.css?raw';

export function reportBlockHtml(b: ReportBlock): string {
  if (b.kind === 'text') return `<p>${esc(b.text).replaceAll('\n', '<br>')}</p>`;
  if (b.kind === 'list') return b.items.length ? `<ul>${b.items.map(v => `<li>${esc(v)}</li>`).join('')}</ul>` : '';
  if (b.kind === 'figure') return `<figure>${b.svg.replace('<svg ', `<svg aria-label="${esc(b.caption)}" `)}<figcaption>${esc(b.caption)}</figcaption></figure>`;
  return b.rows.length ? `<div class="report-table-wrap"><table><thead><tr>${b.headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${esc(c).replaceAll('\n', '<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p>Belum ada data untuk bagian ini.</p>';
}
export function reportHeaderHtml(r: ProjectReport): string {
  return `<header class="report-masthead"><strong>TIRTA</strong><span>LAPORAN PRA-PERENCANAAN</span></header><h1>${esc(r.title)}</h1><p class="report-meta">Revisi ${r.revision} · ${esc(r.scenarioName)} · ${r.mode === 'demo' ? 'CONTOH SINTETIS — bukan data lapangan' : 'Data dan asumsi pengguna'}${r.detail==='detailed' ? `<br>Snapshot proyek: ${esc(r.updatedAt)}` : ''}</p><p class="report-status">${esc(r.status)}</p>${r.metrics ? `<div class="report-result"><span>${r.state === 'selected' ? 'Rencana pilihan Anda' : r.state==='alternative' ? 'Alternatif yang ditinjau' : 'Paket yang sedang disusun'}</span><strong>${number(r.metrics.baseline)} <i>→</i> ${number(r.metrics.residual)} <small>m³</small></strong><span>Limpasan awal → sisa · ${currency(r.metrics.cost)} · ${number(r.metrics.area)} m²</span></div>` : ''}`;
}
export function reportHtml(r: ProjectReport): string {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${esc(r.title)} — Laporan TIRTA</title><style>${styles}</style></head><body><main class="tirta-report">${reportHeaderHtml(r)}<nav aria-label="Isi laporan">${r.sections.map(s=>`<a href="#${s.id}">${esc(s.title)}</a>`).join('')}</nav>${r.sections.map(s=>`<section id="${s.id}"><h2>${esc(s.title)}</h2>${s.blocks.map(reportBlockHtml).join('')}</section>`).join('')}<footer>TIRTA · revisi ${r.revision}${r.detail==='detailed' ? `<br>Identitas input: ${esc(r.inputFingerprint)}` : ''}</footer></main></body></html>`;
}
export function reportFilename(title: string, suffix: string): string {
  const clean = title.normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 72) || 'Proyek';
  return `TIRTA-${clean}.${suffix}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export async function downloadBlob(blob: Blob, name: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const data = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
    const saved = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    await Share.share({ title: name, dialogTitle: 'Simpan atau bagikan berkas TIRTA', url: saved.uri });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
