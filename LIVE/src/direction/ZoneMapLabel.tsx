import type { Point } from "../domain/model";
import { fmt } from "./productionBridge";

export function ZoneMapLabel({ anchor, pixelsPerUnit, clearance, availableWidth, number, name, selected, hovered, compact, ink, contribution, area }: {
  anchor: Point; pixelsPerUnit: number; clearance: number; number: number; name: string;
  selected: boolean; hovered: boolean; compact: boolean; ink: string; contribution?: number; availableWidth?: number; area?: number | null;
}) {
  const room = clearance * pixelsPerUnit;
  const analyticalLabel = contribution !== undefined && !compact;
  const naturalWidthLimit = Math.min(196, availableWidth ?? room * 2);
  const widthLimit = analyticalLabel ? Math.min(196, Math.max(122, naturalWidthLimit)) : naturalWidthLimit;
  const tiny = room < 20 && !analyticalLabel;
  const showName = !compact && !tiny && widthLimit >= 95;
  const showArea = showName && area !== undefined && room >= 24;
  const maxChars = Math.max(5, Math.min(24, Math.floor((widthLimit - 44) / 6.3)));
  const label = name.length > maxChars ? `${name.slice(0, maxChars - 1)}…` : name;
  const width = showName ? Math.min(widthLimit, 44 + label.length * 6.3) : 26;
  const outline = selected ? "#008fda" : hovered ? "#3f8c98" : ink;
  const share = contribution === undefined ? null : Math.max(0, Math.min(1, contribution));
  const hasContribution = share !== null && !tiny;
  const cardY = showArea ? -22 : -15;
  const cardHeight = showArea ? 44 : 30;
  const cardRadius = showName ? 15 : 6;
  return <g className={`zone-mark ${selected ? "is-selected" : ""} ${hovered ? "is-hovered" : ""} ${tiny ? "is-tiny" : ""} ${hasContribution ? "has-contribution" : ""}`} aria-hidden="true" pointerEvents="none"
    data-label-kind={tiny ? "dot" : showName ? "name" : "number"}
    data-contribution={share === null ? undefined : share.toFixed(6)}
    transform={`translate(${anchor.x} ${anchor.y}) scale(${1 / pixelsPerUnit})`}>
    {tiny ? <><circle r="5" fill="white" stroke={outline} strokeWidth={selected || hovered ? "2" : "1.5"} /><circle r="2" fill={selected ? "#345cbe" : ink} /></> : <>
      <rect className="zone-mark-paper" x={-width / 2} y={cardY} width={width} height={cardHeight} rx={cardRadius} />
      {hasContribution && <rect className="zone-mark-contribution-fill" x={-width / 2 + 1} y={cardY + 1} width={Math.max(0,(width - 2) * share)} height={cardHeight - 2} rx={Math.min(cardRadius, (cardHeight - 2) / 2)} style={{width:`${Math.max(0,(width - 2) * share)}px`}} />}
      <rect className="zone-mark-index" x={-width / 2 + 3} y="-10" width="20" height="20" rx="10" fill={selected ? "#008fda" : ink} />
      <text className="zone-mark-number" x={-width / 2 + 13} y="4" textAnchor="middle">{number}</text>
      {showName && <text className="zone-mark-name" x={-width / 2 + 32} y={showArea ? -2 : 4}>{label}</text>}
      {showArea && <text className="zone-mark-area" x={-width / 2 + 32} y="14">{area === null ? "Luas belum diketahui" : `${fmt(area!)} m²`}</text>}
      {hasContribution && showName && <g className="zone-mark-share-chip" transform={`translate(${width / 2 - 34} ${cardY - 8})`}>
        <rect width="34" height="18" rx="9" />
        <text x="17" y="12.5" textAnchor="middle">{Math.round(share * 100)}%</text>
      </g>}
    </>}
  </g>;
}
