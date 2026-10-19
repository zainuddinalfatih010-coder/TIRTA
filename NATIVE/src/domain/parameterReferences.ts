import { referenceV2Schema, type ParameterV2 } from './v2-primitives';
export function referenceIds(input: unknown): Set<string> {
  const ids = new Set<string>();
  const walk = (value: unknown): void => {
    const ref = referenceV2Schema.safeParse(value);
    if (ref.success) { ids.add(ref.data.id); return; }
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(input); return ids;
}
export function referencedParameters(parameters: ParameterV2[], input: unknown): ParameterV2[] {
  const ids = referenceIds(input); return parameters.filter(p => ids.has(p.id));
}
