import type {Point} from './model';
import type {SurfaceContext} from './scientificContract';
import {containsPoint} from './geometry';
/** Test each interval split by polygon boundaries; no hydraulic interpretation. */
function lineInside(polygon:Point[],a:Point,b:Point){
 const dx=b.x-a.x,dy=b.y-a.y,ts=[0,1];
 for(let i=0;i<polygon.length;i++){const c=polygon[i]!,d=polygon[(i+1)%polygon.length]!,ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;if(Math.abs(den)<1e-12)continue;const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;if(t>=0&&t<=1&&u>=0&&u<=1)ts.push(t);}
 ts.sort((a,b)=>a-b);return ts.every((t,i)=>containsPoint(polygon,{x:a.x+dx*t,y:a.y+dy*t})&&(i===0||containsPoint(polygon,{x:a.x+dx*(t+ts[i-1]!)/2,y:a.y+dy*(t+ts[i-1]!)/2})));
}
export function roofGeometryIssues(polygon:Point[],r:NonNullable<SurfaceContext['roof']['routing']>,form?:SurfaceContext['roof']['form'],semantic=true):string[]{
 const issues:string[]=[];
 if(semantic&&form==='flat'&&(r.ridges.length||r.fall.length))issues.push('Atap datar tidak boleh menyimpan garis puncak atau arah turun.');
 if(semantic&&form==='single-slope'&&r.ridges.length)issues.push('Atap satu arah tidak menggunakan garis puncak.');
 if(semantic&&form==='single-slope'&&r.fall.length>1)issues.push('Atap satu arah hanya boleh memiliki satu arah turun aktif.');
 const fallKeys=r.fall.map(f=>JSON.stringify([f.from,f.to]));
 if(semantic&&new Set(fallKeys).size!==fallKeys.length)issues.push('Arah turun duplikat tidak boleh dihitung sebagai bidang atap berbeda.');
 if(r.outletEdge!==null&&r.outletEdge>=polygon.length)issues.push('Sisi outlet tidak tersedia.');
 if(r.outletPoint&&!containsPoint(polygon,r.outletPoint))issues.push('Outlet harus berada pada atap.');
 for(const line of [...r.ridges,...r.fall.map(f=>[f.from,f.to] as [Point,Point])]){
 if(Math.hypot(line[0].x-line[1].x,line[0].y-line[1].y)<.001)issues.push('Arah atau puncak memerlukan dua titik berbeda.');
 else if(!lineInside(polygon,line[0],line[1]))issues.push('Letakkan garis di dalam atap.');}
 return [...new Set(issues)];
}
