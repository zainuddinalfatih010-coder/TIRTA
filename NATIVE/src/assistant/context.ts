import { lookupKnowledge, type HelpDestination } from './knowledge';
import type { ProjectV2 } from '../domain/projectV2';

export type AssistantStep = HelpDestination | 'compare' | 'impact';
export type AssistantTopic = Exclude<AssistantStep, 'compare'>;

export function topicForStep(step: AssistantStep): AssistantTopic {
  return step === 'compare' ? 'alternatives' : step;
}

// Presentation context only. This never decides scientific inputs or applies a plan.
export function topicForQuestion(question: string): AssistantTopic | null {
  const text = question.normalize('NFKC').toLocaleLowerCase('id-ID');
  if (/rencana (pilihan|terpilih)|hasil akhir|kesimpulan|dampak rencana/.test(text)) return 'impact';
  if (/paket|rekomend|alternatif|banding|paling efektif/.test(text)) return 'alternatives';
  if (/intervensi|permeabel|permeable|paving berpori/.test(text)) return 'interventions';
  return lookupKnowledge(text)?.destination ?? null;
}

export function objectsForQuestion(question: string, project: ProjectV2) {
  const text = question.normalize('NFKC').toLocaleLowerCase('id-ID');
  const named = <T extends { id: string; name: string }>(items: readonly T[]) => [...items]
    .sort((a, b) => b.name.length - a.name.length)
    .find(item => item.name.length >= 3 && text.includes(item.name.toLocaleLowerCase('id-ID')))?.id;
  const knowledge = lookupKnowledge(text);
  const family: ProjectV2['components'][number]['family'] | null = /permeabel|permeable|paving berpori/.test(text) ? 'permeable'
    : knowledge?.id === 'tank' ? 'storage' : knowledge?.id === 'infiltration' ? 'infiltration'
      : knowledge?.id === 'garden' ? 'rain-garden' : null;
  return {
    interventionFamily: family,
    zoneId: named(project.zones),
    interventionId: named(project.components) ?? (family ? project.components.find(c => c.family === family && c.enabled)?.id ?? project.components.find(c => c.family === family)?.id : undefined),
  };
}
