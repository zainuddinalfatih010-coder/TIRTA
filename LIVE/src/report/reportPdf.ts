import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ProjectReport, ReportBlock } from './projectReport';
import { number, currency } from './projectReport';

const printable = (v:string) => v.replaceAll('→','ke').replaceAll('·',' / ');
function block(b: ReportBlock, compact=false, mapHeight=160): Content[] {
  if (b.kind === 'text') return [{ text:printable(b.text), unbreakable:b.text.length<900, margin:[0,0,0,7] }];
  if (b.kind === 'list') return b.items.length ? [{ ul:b.items.map(v => ({ text:printable(v), margin:[0,0,0,compact?3:5] })), margin:[0,0,0,compact?0:10] }] : [];
  if (b.kind === 'figure') return [{stack:[{ svg:b.svg, ...(compact&&b.svg.includes('<polygon')?{fit:[490,mapHeight] as [number,number]}:{width:490}), margin:[0,4,0,6] }, { text:printable(b.caption), style:'caption' }],unbreakable:true,margin:[0,0,0,compact?8:12]}];
  // Keep a short first data row with its header; long source rows must still split.
  return b.rows.length ? [{ table:{ headerRows:1, keepWithHeaderRows:b.rows[0]!.every(value=>value.length<700)?1:0, dontBreakRows:b.rows.every(row=>row.every(value=>value.length<700)), widths:b.headers.map((_,i) => b.headers.length===4 && (i===1 || i===2) ? 'auto' : '*'), body:[b.headers.map(h=>({text:h,bold:true,fillColor:'#d9eff7',color:'#123f59'})), ...b.rows.map(r=>r.map(c=>({text:printable(c),fontSize:9})))] }, layout:{ hLineWidth:()=>.5, vLineWidth:()=>0, hLineColor:()=>'#c5dce6', paddingTop:()=>compact?2:6,paddingBottom:()=>compact?2:6,paddingLeft:()=>6,paddingRight:()=>6 }, margin:[0,0,0,compact?11:15] }] : [{ text:'Belum ada data untuk bagian ini.',style:'caption' }];
}
export function reportPdfDefinition(r: ProjectReport): TDocumentDefinitions {
  // Put material uncertainty next to the conclusion, using the space before the
  // parcel map instead of leaving a mostly empty final page of caveats.
  const smallParcel=r.sections.find(s=>s.id==='parcel')?.blocks.find(b=>b.kind==='table');
  const smallMap=smallParcel?.kind==='table'&&smallParcel.rows.length<=2&&r.sections.find(s=>s.id==='plan')?.blocks.every(b=>b.kind==='table'&&b.rows.length===0);
  const mapHeight=smallMap?80:160;
  const sections=r.detail==='summary'
    ? [...r.sections.filter(s=>s.id==='summary'),...r.sections.filter(s=>s.id==='verification'),...r.sections.filter(s=>s.id!=='summary'&&s.id!=='verification')]
      .filter(s=>s.blocks.some(b=>b.kind!=='table'||b.rows.length>0))
    : r.sections;
  const recommendationPage:Content[]=r.recommendation ? [{pageBreak:'before',stack:[
    {text:'REKOMENDASI',style:'eyebrow',margin:[0,0,0,7]},
    {text:r.recommendation.headline,style:'h1',margin:[0,0,0,8]},
    {text:r.recommendation.summary,color:'#496b7c',margin:[0,0,0,14]},
    ...(r.recommendation.userReason ? [{table:{widths:['auto','*'],body:[[{text:'Alasan pilihan Anda',bold:true,color:'#123f59'},{text:r.recommendation.userReason}]]},layout:{hLineWidth:()=>0,vLineWidth:()=>0,paddingTop:()=>7,paddingBottom:()=>7,paddingLeft:()=>8,paddingRight:()=>8},fillColor:'#eef8fc',margin:[0,0,0,14]} as Content] : []),
    {columns:[
      {width:'*',stack:[{text:'Kenapa pilihan ini masuk akal',style:'h2',margin:[0,0,0,7]},{ul:r.recommendation.strengths.slice(0,6).map(text=>({text,margin:[0,0,0,4]}))}]},
      {width:'*',stack:[{text:'Prioritas sebelum diterapkan',style:'h2',margin:[0,0,0,7]},...(r.recommendation.actions.length ? [{ol:r.recommendation.actions.slice(0,6).map(item=>({text:[{text:`${item.title}. `,bold:true},item.detail],margin:[0,0,0,4]}))}] : [{text:'Tidak ada pemeriksaan tambahan yang dibangkitkan dari data rencana saat ini.',color:'#496b7c'}])],margin:[16,0,0,0]},
    ],columnGap:18,margin:[0,0,0,14]},
    {columns:[
      {width:'*',stack:[{text:'Ketahanan pada skenario hujan',style:'h2',margin:[0,0,0,7]},{ul:r.recommendation.scenarioNotes.slice(0,4).map(text=>({text,margin:[0,0,0,4]}))}]},
      {width:'*',stack:[{text:'Jika ingin meningkatkan hasil',style:'h2',margin:[0,0,0,7]},...(r.recommendation.improvement.length ? [{ul:r.recommendation.improvement.slice(0,3).map(text=>({text,margin:[0,0,0,4]}))}] : [{text:'Tidak ada fokus tambahan yang muncul dari sisa limpasan pada skenario aktif.',color:'#496b7c'}])],margin:[16,0,0,0]},
    ],columnGap:18},
  ]} as Content] : [];
  return {
    pageSize:'A4', pageMargins:[42,48,42,48],
    info:{ title:`${r.title} — Laporan TIRTA`, author:'TIRTA', subject:'Pra-perencanaan air hujan', creationDate:new Date(r.updatedAt), modDate:new Date(r.updatedAt) },
    defaultStyle:{font:'Roboto',fontSize:10.5,lineHeight:r.detail==='summary'?1.18:1.28,color:'#173f56'},
    pageBreakBefore:(node,queries) => node.headlineLevel === 1 && queries.getFollowingNodesOnPage().length === 0,
    styles:{ h1:{fontSize:27,bold:true,color:'#103d58'},h2:{fontSize:r.detail==='summary'?16:18,bold:true,color:'#103d58'},caption:{fontSize:8.5,color:'#496b7c'},eyebrow:{fontSize:9,bold:true,color:'#0b708e'} },
    header:() => ({ text:'TIRTA  /  LAPORAN PRA-PERENCANAAN',style:'eyebrow',margin:[42,22,42,0] }),
    footer:(page,total) => ({ columns:[{text:`TIRTA · revisi ${r.revision} · pra-perencanaan`},{text:`${page} / ${total}`,alignment:'right'}],fontSize:8,color:'#496b7c',margin:[42,17,42,0] }),
    content:[
      {text:r.title,style:'h1',margin:[0,3,0,10]},
      {text:`${r.scenarioName} · revisi ${r.revision}\n${r.mode === 'demo' ? 'CONTOH SINTETIS — bukan data lapangan' : 'Data dan asumsi pengguna'}${r.detail==='detailed' ? `\nSnapshot proyek: ${r.updatedAt}` : ''}`,style:'caption',margin:[0,0,0,12]},
      {text:r.status,color:'#0b708e',margin:[0,0,0,12]},
      ...(r.metrics && r.detail==='detailed' ? [{table:{widths:['*'],body:[[{stack:[{text:r.state==='selected'?'Rencana pilihan Anda':r.state==='alternative'?'Alternatif yang ditinjau':'Paket yang sedang disusun',fontSize:11,bold:true},{columns:[{text:number(r.metrics.baseline),fontSize:32,bold:true,color:'#123f59',width:'auto'},{stack:[{svg:'<svg xmlns="http://www.w3.org/2000/svg" width="36" height="24"><path d="M2 12 H32 M23 3 L32 12 L23 21" fill="none" stroke="#54b9af" stroke-width="3"/></svg>',width:28,margin:[10,11,0,0]}],width:52},{text:`${number(r.metrics.residual)} m³`,fontSize:32,bold:true,color:'#087986',width:'*'}],margin:[0,6,0,6]},{text:`Limpasan awal ke sisa / ${currency(r.metrics.cost)} / ${number(r.metrics.area)} m²`,fontSize:10}],fillColor:'#e7f6fa',margin:[8,8,8,8]}]]},layout:'noBorders',margin:[0,0,0,16]} as Content] : []),
      ...sections.flatMap((s,index):Content[]=>{
        const heading:Content={text:s.title,style:'h2',headlineLevel:1,margin:[0,index>0?(r.detail==='summary'?12:18):0,0,r.detail==='summary'?9:13]};
        // The parcel introduction alone is not a meaningful first page of the map.
        // Keep that bounded group together; long tables and evidence lists still paginate.
        if(s.id==='parcel' && s.blocks[0]?.kind==='text' && s.blocks[1]?.kind==='figure')return [
          {stack:[heading,...s.blocks.slice(0,2).flatMap(b=>block(b,r.detail==='summary',mapHeight))],unbreakable:true},
          ...s.blocks.slice(2).flatMap(b=>block(b,r.detail==='summary',mapHeight)),
        ];
        if(r.detail==='summary' && s.id==='verification')return [{stack:[heading,...s.blocks.flatMap(b=>block(b,true))],fontSize:9.5,lineHeight:1.1,unbreakable:s.blocks.every(b=>b.kind==='list'&&b.items.join('').length<1800)}];
        const first=s.blocks[0];
        const comparisonTable=s.blocks[1];
        if(s.id==='comparison' && first?.kind==='text' && first.text.length<220 && comparisonTable?.kind==='table' && comparisonTable.rows.length<=4 && comparisonTable.rows.every(row=>row.every(value=>value.length<220)))return [
          {stack:[heading,...s.blocks.slice(0,2).flatMap(b=>block(b,r.detail==='summary'))],unbreakable:true},
          ...s.blocks.slice(2).flatMap(b=>block(b,r.detail==='summary',mapHeight)),
        ];
        if(first?.kind==='table'&&first.rows.length<=4&&first.rows.every(row=>row.every(value=>value.length<220)))return [{stack:[heading,...block(first,r.detail==='summary')],unbreakable:true},...s.blocks.slice(1).flatMap(b=>block(b,r.detail==='summary',mapHeight))];
        return [heading,...s.blocks.flatMap(b=>block(b,r.detail==='summary',mapHeight))];
      }),
      ...(r.detail==='detailed' ? [{text:`Model laporan v${r.version} / Identitas input: ${r.inputFingerprint}`,style:'caption',unbreakable:true,margin:[0,8,0,0]} as Content] : []),
      ...recommendationPage,
    ],
  };
}

/** Only loaded for PDF export; packaged fonts and all code work without a server. */
export async function reportPdfBlob(r: ProjectReport): Promise<Blob> {
  const [{default:pdf}, {default:fonts}] = await Promise.all([import('pdfmake/build/pdfmake'),import('pdfmake/build/vfs_fonts')]);
  pdf.addVirtualFileSystem(fonts);
  return pdf.createPdf(reportPdfDefinition(r)).getBlob();
}
