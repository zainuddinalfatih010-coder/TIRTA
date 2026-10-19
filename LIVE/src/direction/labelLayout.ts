import type { Point } from "../domain/model";
/** Radius of clear drawing space; used only to fit visual annotations. */
export function visualLabelClearance(points: Point[], p: Point): number {
  return Math.min(...points.map((a, i) => {
    const b = points[(i + 1) % points.length]!, dx = b.x - a.x, dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }));
}
/** Width available to an upright label, sampling its top, middle and bottom. */
export function visualLabelWidth(points: Point[], anchor: Point, halfHeight: number): number {
  return 2 * Math.min(...[-halfHeight, 0, halfHeight].map(offset => {
    const y = anchor.y + offset;
    const intersections = points.flatMap((a, i) => {
      const b = points[(i + 1) % points.length]!;
      return (a.y > y) !== (b.y > y) ? [a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y)] : [];
    }).sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const left = intersections[i]!, right = intersections[i + 1]!;
      if (left <= anchor.x && anchor.x <= right) return Math.min(anchor.x - left, right - anchor.x);
    }
    return 0;
  }));
}
/** Screen-space label placement only; never used as measured geometry. */
export function visualLabelAnchor(points: Point[]): Point {
  const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
  const left=Math.min(...xs), right=Math.max(...xs), top=Math.min(...ys), bottom=Math.max(...ys);
  const inside=(p:Point) => {
    let hit=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++) {
      const a=points[i]!,b=points[j]!;
      if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) hit=!hit;
    }
    return hit;
  };
  const center={x:(left+right)/2,y:(top+bottom)/2};
  let best=points[0]!, score=-Infinity;
  const candidates=[center];
  for(let y=1;y<20;y++) for(let x=1;x<20;x++) candidates.push({x:left+(right-left)*x/20,y:top+(bottom-top)*y/20});
  for(const p of candidates) {
    if(!inside(p)) continue;
    let distance=Infinity;
    for(let i=0;i<points.length;i++) {
      const a=points[i]!,b=points[(i+1)%points.length]!;
      const dx=(b.x-a.x)/90,dy=(b.y-a.y)/30,px=(p.x-a.x)/90,py=(p.y-a.y)/30;
      const t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy)));
      distance=Math.min(distance,Math.hypot(px-t*dx,py-t*dy));
    }
    if(distance>score) { score=distance; best=p; }
  }
  return best;
}
