import { ChevronRight, Grid2X2, LockKeyhole, Magnet, MoveHorizontal, Ruler } from 'lucide-react';
import './drawing-settings.css';

type Props = {
  headingId: string;
  axisLock: boolean; onAxisLock: (value: boolean) => void;
  snap: boolean; onSnap: (value: boolean) => void;
  grid: boolean; onGrid: (value: boolean) => void;
  align: boolean; onAlign: (value: boolean) => void;
  hasParcel: boolean; onDimensions: () => void;
};
export function DrawingSettings(props: Props) {
  const rows = [
    { label: 'Kunci X/Y', icon: LockKeyhole, checked: props.axisLock, change: props.onAxisLock },
    { label: 'Snap ke meteran', icon: Magnet, checked: props.snap, change: props.onSnap },
    { label: 'Kisi bantu', icon: Grid2X2, checked: props.grid, change: props.onGrid },
    ...(props.hasParcel ? [{ label: 'Sejajar X/Y', icon: MoveHorizontal, checked: props.align, change: props.onAlign }] : []),
  ];
  return <>
    <h2 id={props.headingId}><Ruler size={18} aria-hidden="true"/>Bantuan gambar</h2>
    <div className="drawing-setting-rows">{rows.map(({ label, icon: Icon, checked, change }) =>
      <label className="drawing-setting" key={label}><Icon size={18} aria-hidden="true"/><span>{label}</span><input type="checkbox" role="switch" checked={checked} onChange={event => change(event.target.checked)}/></label>
    )}</div>
    {props.hasParcel && <button className="drawing-dimensions" type="button" onClick={props.onDimensions}><Ruler size={18} aria-hidden="true"/><span>Ubah dimensi awal</span><ChevronRight size={17} aria-hidden="true"/></button>}
  </>;
}
