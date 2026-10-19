import { blankSnapshot, demoProject, setActiveComponents } from '../direction/productionBridge';
import { unknownNumber } from '../domain/scientificContract';

/** Owner evidence is qualitative; no measured school geometry or hydrology was supplied. */
export function partialActualPilot() {
  const p = blankSnapshot().project;
  p.id = 'actual-pilot-awaiting-data'; p.name = 'Pilot pembina — data lokasi belum tersedia';
  return p;
}

/** Software presentation case only. Never claim these numbers describe the actual pilot. */
export function hypotheticalSchool() {
  const p = setActiveComponents(demoProject(), ['tank', 'garden']);
  p.name = 'Sekolah hipotetis — bukan hasil ukur pilot';
  for (const id of ['tank', 'garden']) p.components.find(c=>c.id===id)!.treatment = {
    installationZoneId: id === 'tank' ? 'z2' : 'z3', sharedSourceMode: 'ledger',
    allocationNote: 'Urutan volume sintetis; bukan pembagian debit', catchmentReviewed: true,
  };
  const garden = p.science!.interventions.garden!;
  garden.soilInfiltration = unknownNumber('mm/h');
  garden.groundwaterAssessment = 'unknown'; garden.groundwaterBasis = '';
  return p;
}
