/**
 * Minimal runtime shape validation for the reportes-sql contract.
 *
 * TypeScript casts (`as FetchResponse<T>`) erase at compile time; these
 * guards keep the trust boundary explicit so a backend contract change
 * surfaces as a clear error instead of a confusing crash (or, worse,
 * silently misrendered data) further up the stack.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPaginatedResponse(
  value: unknown,
): value is { items: Array<unknown>; total: number; page: number; size: number; pages: number } {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    typeof value.total === 'number' &&
    typeof value.page === 'number' &&
    typeof value.size === 'number' &&
    typeof value.pages === 'number'
  );
}

export function isSeriesResponse(
  value: unknown,
): value is { items: Array<unknown>; indicador_id: string; anio: number; granularity: string } {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    typeof value.indicador_id === 'string' &&
    typeof value.anio === 'number' &&
    typeof value.granularity === 'string'
  );
}

export function isSQLPreview(
  value: unknown,
): value is {
  sql: string;
  params: Record<string, unknown>;
  periodo_inicio: string;
  periodo_fin: string;
  version_id: string;
  version_num: number;
} {
  return (
    isRecord(value) &&
    typeof value.sql === 'string' &&
    isRecord(value.params) &&
    typeof value.periodo_inicio === 'string' &&
    typeof value.periodo_fin === 'string' &&
    typeof value.version_id === 'string' &&
    typeof value.version_num === 'number'
  );
}

export function assertShape<T>(value: T, guard: (value: unknown) => boolean, resource: string): T {
  if (!guard(value)) {
    throw new Error(`reportes-sql devolvió una respuesta inesperada para ${resource}.`);
  }
  return value;
}
