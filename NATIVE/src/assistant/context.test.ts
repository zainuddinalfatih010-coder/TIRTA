import { describe, expect, it } from 'vitest';
import { objectsForQuestion, topicForQuestion, topicForStep } from './context';
import { demoProject, setActiveComponents } from '../direction/productionBridge';

describe('assistant presentation context', () => {
  it('keeps workflow origin, including the comparison step', () => {
    expect(topicForStep('studio')).toBe('studio');
    expect(topicForStep('rain')).toBe('rain');
    expect(topicForStep('interventions')).toBe('interventions');
    expect(topicForStep('compare')).toBe('alternatives');
    expect(topicForStep('impact')).toBe('impact');
  });
  it('follows a meaningful topic and prioritizes package comparison over rain keywords', () => {
    expect(topicForQuestion('Dari mana angka limpasan?')).toBe('rain');
    expect(topicForQuestion('Mengapa C belum dipilih?')).toBe('studio');
    expect(topicForQuestion('Bagaimana tangki dikosongkan?')).toBe('interventions');
    expect(topicForQuestion('Paket mana yang paling efektif saat hujan 100 mm?')).toBe('alternatives');
    expect(topicForQuestion('Kesimpulan rencana pilihan saya?')).toBe('impact');
    expect(topicForQuestion('Cara simpan proyek?')).toBe('project');
  });
  it('does not invent a topic for a general follow-up', () => {
    expect(topicForQuestion('Jelaskan lagi dong')).toBeNull();
    expect(topicForQuestion('Oke terima kasih')).toBeNull();
  });
  it('uses only declared objects for names and intervention families', () => {
    const project = setActiveComponents(demoProject(true), ['tank', 'soak', 'garden', 'porous']);
    expect(objectsForQuestion('Bagaimana tangki dikosongkan?', project).interventionId).toBe('tank');
    expect(objectsForQuestion('Rain garden perlu tanaman apa?', project).interventionId).toBe('garden');
    expect(objectsForQuestion('Paving berpori dipasang di mana?', project).interventionId).toBe('porous');
    expect(objectsForQuestion(`C untuk ${project.zones[0]!.name}?`, project).zoneId).toBe(project.zones[0]!.id);
    expect(objectsForQuestion('Jelaskan lagi', project)).toEqual({ zoneId: undefined, interventionId: undefined, interventionFamily: null });
    const onlyTank = { ...project, components: project.components.filter(c => c.family === 'storage') };
    expect(objectsForQuestion('Rain garden perlu tanaman apa?', onlyTank)).toMatchObject({ interventionId: undefined, interventionFamily: 'rain-garden' });
  });
});
