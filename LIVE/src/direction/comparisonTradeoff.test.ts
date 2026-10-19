import {describe,expect,it} from 'vitest';
import {comparisonTradeoffNote} from './comparisonTradeoff';

const rows=[
 {id:'lean',cost:2_500_000,area:4,residual:5.9},
 {id:'effective',cost:3_000_000,area:6,residual:3.2},
];

describe('comparison trade-off notes',()=>{
 it('explains cost and land strength without hiding weaker runoff performance',()=>{
  const note=comparisonTradeoffNote(rows,'lean');
  expect(note.headline).toMatch(/Hemat biaya.*lahan|Hemat lahan.*biaya/);
  expect(note.detail).toMatch(/sisa limpasan lebih tinggi/i);
 });
 it('explains runoff strength without pretending cost and land are also best',()=>{
  const note=comparisonTradeoffNote(rows,'effective');
  expect(note.headline).toMatch(/efektif.*limpasan/i);
  expect(note.detail).toMatch(/biaya lebih tinggi/i);
  expect(note.detail).toMatch(/lahan lebih besar/i);
 });
 it('calls out a package that is no worse on every primary comparison metric',()=>{
  const dominant=[{id:'best',cost:2_000_000,area:3,residual:2.5},{id:'other',cost:3_000_000,area:6,residual:4.5}];
  const note=comparisonTradeoffNote(dominant,'best');
  expect(note.headline).toBe('Unggul di semua metrik utama');
  expect(note.detail).toMatch(/biaya.*lahan.*sisa limpasan/i);
 });
});
