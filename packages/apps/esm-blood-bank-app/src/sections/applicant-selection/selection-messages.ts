import spanish from '../../../translations/es.json';

// Defaults also work before the lazy ESM translation bundle has loaded.
export const selectionMessages: Record<string, { es: string }> = Object.fromEntries(
  Object.entries(spanish.selection).map(([key, es]) => [key, { es }]),
);
