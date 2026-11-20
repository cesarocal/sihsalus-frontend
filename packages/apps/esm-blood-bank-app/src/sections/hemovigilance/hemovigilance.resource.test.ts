import { openmrsFetch } from '@openmrs/esm-framework';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { transfusionRequestsMock } from '../../mocks/transfusions.mock';
import { type Dispatch, demoMetadata, reportDefaults } from './hemovigilance';
import { listHemovigilance } from './hemovigilance.resource';

vi.mock('@openmrs/esm-framework', () => ({ openmrsFetch: vi.fn(), restBaseUrl: '/ws/rest/v1' }));

const order = transfusionRequestsMock()[0].order;
const actor = { name: 'Operadora de prueba', personUuid: 'operator-id', license: '' };
const dispatch: Dispatch = {
  unitCode: 'UNIT-A',
  lot: 'LOT-A',
  component: 'redCells',
  bloodGroup: 'O+',
  seal: 'SEAL-A',
  deliveredAt: '2026-11-19T15:00:00Z',
};

function event(uuid: string, kind: 'dispatch' | 'report' | 'conduction', unitCode: string, previous = '') {
  return {
    uuid,
    encounterDatetime: '2026-11-19T15:00:00Z',
    patient: { uuid: order.patientId },
    encounterType: { uuid: demoMetadata.encounters[kind] },
    obs: [
      {
        concept: { uuid: demoMetadata.text },
        value: JSON.stringify({
          version: 1,
          orderId: order.id,
          kind,
          dispatch: { ...dispatch, unitCode },
          actor,
          fields: { startTime: '10:00' },
          previous,
        }),
      },
    ],
  };
}
function deliverEvents(results: ReturnType<typeof event>[]) {
  vi.mocked(openmrsFetch).mockResolvedValueOnce({
    data: { person: { attributes: [{ attributeType: { uuid: demoMetadata.testPatient }, value: 'true' }] } },
  } as Awaited<ReturnType<typeof openmrsFetch>>);
  vi.mocked(openmrsFetch).mockResolvedValueOnce({ data: { results } } as Awaited<ReturnType<typeof openmrsFetch>>);
}

afterEach(() => vi.resetAllMocks());

describe('hemovigilance records', () => {
  it('keeps the FR02 and conduction attached to their exact dispatched unit', async () => {
    deliverEvents([
      event('report-a', 'report', 'UNIT-A'),
      event('delivery-a', 'dispatch', 'UNIT-A'),
      event('delivery-b', 'dispatch', 'UNIT-B'),
      event('conduction-b', 'conduction', 'UNIT-B'),
    ]);
    const [first, second] = await listHemovigilance([order]);
    expect(first.sections.report?.uuid).toBe('report-a');
    expect(first.sections.conduction).toBeUndefined();
    expect(second.sections.report).toBeUndefined();
    expect(second.sections.conduction?.uuid).toBe('conduction-b');
  });

  it('detects competing writes to the same revision', async () => {
    deliverEvents([
      event('delivery', 'dispatch', 'UNIT-A'),
      event('initial', 'conduction', 'UNIT-A'),
      event('edit-a', 'conduction', 'UNIT-A', 'initial'),
      event('edit-b', 'conduction', 'UNIT-A', 'initial'),
    ]);
    await expect(listHemovigilance([order])).rejects.toThrow('HEMOVIGILANCE_CONFLICT');
  });

  it('copies actual start and volume without classifying monitoring readings as pre/post', () => {
    const fields = reportDefaults({ startTime: '10:02', transfused: '150', temperature0: '37', temperature4: '39' });
    expect(fields).toMatchObject({ startTime: '10:02', transfused: '150' });
    expect(fields).not.toHaveProperty('temperatureAfter');
  });
});
