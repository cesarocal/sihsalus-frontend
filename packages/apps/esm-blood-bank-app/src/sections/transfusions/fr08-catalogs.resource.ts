import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

interface ServiceOption {
  uuid: string;
  name: string;
  retired?: boolean;
}

export async function listFr08Services() {
  const { data } = await openmrsFetch<ServiceOption[]>(`${restBaseUrl}/appointmentService/all/full`);
  return [
    ...new Map(
      data.filter(({ retired, uuid, name }) => !retired && uuid && name).map((service) => [service.uuid, service]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export interface DiagnosisOption {
  uuid: string;
  name: string;
  code?: string;
}

interface DiagnosisConcept {
  uuid: string;
  display: string;
  names?: { display: string; conceptNameType: string }[];
  conceptMappings?: { conceptReferenceTerm?: { code?: string; conceptSource?: { name?: string; display?: string } } }[];
}

const diagnosisClass = '8d4918b0-c2cc-11de-8d13-0010c6dffd0f';
const codePattern = /^[A-Z]\d[A-Z0-9.]{1,5}$/i;
const codeKey = (code: string) => code.replace(/[.\s]/g, '').toUpperCase();

function diagnosisCode(concept: DiagnosisConcept) {
  const mapped = concept.conceptMappings?.find(({ conceptReferenceTerm: term }) => {
    const source = term?.conceptSource?.name || term?.conceptSource?.display || '';
    return /(?:CIE|ICD)[\s-]?10/i.test(source) && term?.code && codePattern.test(term.code);
  });
  return (
    mapped?.conceptReferenceTerm?.code ??
    concept.names?.find(({ display, conceptNameType }) => conceptNameType === 'SHORT' && codePattern.test(display))
      ?.display
  );
}

export async function searchFr08Diagnoses(query: string, signal: AbortSignal): Promise<DiagnosisOption[]> {
  const compact = codeKey(query);
  const exactCode = /^[A-Z][0-9][A-Z0-9]{1,4}$/.test(compact) ? compact : undefined;
  const dottedCode = exactCode && exactCode.length > 3 ? `${exactCode.slice(0, 3)}.${exactCode.slice(3)}` : exactCode;
  const terms = exactCode && dottedCode ? new Set([query, exactCode, dottedCode]) : [query];
  const pages = await Promise.all(
    [...terms].map(async (name) => {
      const params = new URLSearchParams({
        name,
        class: diagnosisClass,
        searchType: 'fuzzy',
        limit: '20',
        v: 'custom:(uuid,display,names:(display,conceptNameType),conceptMappings:(conceptReferenceTerm:(conceptSource:(name,display),code)))',
      });
      const { data } = await openmrsFetch<{ results: DiagnosisConcept[] }>(`${restBaseUrl}/concept?${params}`, {
        signal,
      });
      return data.results;
    }),
  );
  const results = new Map<string, DiagnosisOption>();
  for (const concept of pages.flat()) {
    results.set(concept.uuid, { uuid: concept.uuid, name: concept.display, code: diagnosisCode(concept) });
  }
  const isExact = (item: DiagnosisOption) => Boolean(exactCode && item.code && codeKey(item.code) === exactCode);
  return [...results.values()].sort((a, b) => Number(isExact(b)) - Number(isExact(a))).slice(0, 20);
}
