import { localDateTime } from './screening-rules';
import { screeningTests, type ScreeningRecord, type ScreeningResult } from './screening.types';

export function screeningResultsFixture(
  record: ScreeningRecord,
  result: ScreeningResult = 'nonReactive',
): ScreeningRecord {
  return {
    ...record,
    performedBy: 'Laboratorio DEMO',
    performedOn: localDateTime(),
    bloodData: { aboGroup: 'O', rhFactor: '+', hematocrit: '42', hemoglobin: '14' },
    recommendations: { gastroenterology: 'no', infectiousDiseases: 'no', procets: 'no' },
    tests: Object.fromEntries(screeningTests.map((test) => [test, { result }])) as ScreeningRecord['tests'],
  };
}
