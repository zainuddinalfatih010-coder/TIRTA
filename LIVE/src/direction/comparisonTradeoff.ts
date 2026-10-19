export type ComparisonTradeoffMetric={id:string;cost:number;area:number;residual:number};
export type ComparisonTradeoffNote={headline:string;detail:string};
const close=(a:number,b:number)=>Math.abs(a-b)<=1e-9;
const join=(items:string[])=>items.length<=1?(items[0]??''):items.length===2?`${items[0]} dan ${items[1]}`:`${items.slice(0,-1).join(', ')}, dan ${items.at(-1)}`;
export function comparisonTradeoffNote(rows:readonly ComparisonTradeoffMetric[],id:string):ComparisonTradeoffNote{
 const current=rows.find(row=>row.id===id);
 if(!current)return{headline:'Perbandingan belum tersedia',detail:'Paket ini belum memiliki metrik yang cukup untuk dibandingkan.'};
 if(rows.length<2)return{headline:'Satu paket sedang dibandingkan',detail:'Tambahkan paket lain untuk melihat kompromi biaya, lahan, dan sisa limpasan.'};
 const minCost=Math.min(...rows.map(row=>row.cost)),minArea=Math.min(...rows.map(row=>row.area)),minResidual=Math.min(...rows.map(row=>row.residual));
 const bestCost=close(current.cost,minCost),bestArea=close(current.area,minArea),bestResidual=close(current.residual,minResidual);
 const dominatesAll=rows.every(row=>row.id===id||(current.cost<=row.cost&&current.area<=row.area&&current.residual<=row.residual))&&rows.some(row=>row.id!==id&&(current.cost<row.cost||current.area<row.area||current.residual<row.residual));
 if(dominatesAll&&bestCost&&bestArea&&bestResidual)return{headline:'Unggul di semua metrik utama',detail:'Biaya, kebutuhan lahan, dan sisa limpasan tidak lebih buruk daripada paket lain yang sedang dibandingkan.'};
 const strengths:string[]=[];if(bestCost)strengths.push('biaya');if(bestArea)strengths.push('lahan');if(bestResidual)strengths.push('sisa limpasan');
 const tradeoffs:string[]=[];if(!bestCost)tradeoffs.push('biaya lebih tinggi');if(!bestArea)tradeoffs.push('lahan lebih besar');if(!bestResidual)tradeoffs.push('sisa limpasan lebih tinggi');
 let headline='Kompromi menengah';
 if(bestResidual&&bestCost)headline='Efektif dan hemat biaya';
 else if(bestResidual&&bestArea)headline='Efektif dan hemat lahan';
 else if(bestCost&&bestArea)headline='Hemat biaya & lahan';
 else if(bestResidual)headline='Paling efektif menekan limpasan';
 else if(bestCost)headline='Biaya paling rendah';
 else if(bestArea)headline='Lahan paling hemat';
 const detail=strengths.length?`Unggul pada ${join(strengths)}; komprominya: ${join(tradeoffs)}.`:`Belum unggul pada biaya, lahan, atau sisa limpasan; pertimbangkan tujuan utama rencana.`;
 return{headline,detail};
}
