import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { builtInColumns, configSchema, defaultQueueTable } from './config-schema';

const frontendConfig = JSON.parse(readFileSync(resolve(process.cwd(), '../../../config/frontend.json'), 'utf8'));

describe('service queues configuration defaults', () => {
  it('enables both obstetric circuits without changing the outpatient arrival contract', () => {
    const queueConfig = frontendConfig['@sihsalus/esm-service-queues-app'];
    const care = queueConfig.obstetricCare;
    expect(care.enabled).toBe(true);
    expect(care.inpatientQueueUuid).toBe('c9d0e1f2-a3b4-45c6-d7e8-f9a0b1c2d3e4');
    expect(care.inpatientQueueUuid).not.toBe(care.outpatientQueueUuid);
    const rules = frontendConfig['@sihsalus/esm-appointments-app'].appointmentArrivalRules.filter(
      (rule: { appointmentServiceUuid: string }) =>
        rule.appointmentServiceUuid === care.outpatientAppointmentServiceUuid,
    );
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      queueUuid: care.outpatientQueueUuid,
      requiresTriage: true,
      appointmentLocationUuid: '35d2234e-129a-4c40-abb2-1ae0b2400001',
    });
    expect(configSchema.obstetricCare.enabled._default).toBe(false);
  });

  it('uses the SIHSALUS visit queue number attribute', () => {
    expect(configSchema.visitQueueNumberAttributeUuid._default).toBe('06a0b8c6-cbdf-4b42-9cbd-871129db8758');
  });

  it('provides operational triage columns in the default worklist', () => {
    expect(builtInColumns).toEqual(expect.arrayContaining(['appointment-time', 'triage-status', 'sis-status']));
    expect(defaultQueueTable.columns).toEqual(
      expect.arrayContaining(['patient-name', 'appointment-time', 'triage-status', 'sis-status', 'actions']),
    );
  });

  it('uses the provisioned service finished concept for completed triage routing', () => {
    expect(configSchema.concepts.finishedServiceStatusConceptUuid._default).toBe(
      '707b1d1e-d7f7-4dad-a382-3734e35933c3',
    );
  });

  it('owns the same outpatient triage contract as appointments', () => {
    const appointmentsConfig = frontendConfig['@sihsalus/esm-appointments-app'];
    const queueConfig = frontendConfig['@sihsalus/esm-service-queues-app'].appointmentTriage;
    const appointmentArrivalRules = appointmentsConfig.appointmentArrivalRules
      .filter(({ requiresTriage }: { requiresTriage?: boolean }) => requiresTriage)
      .map(
        ({
          appointmentServiceUuid,
          appointmentLocationUuid,
          queueUuid,
        }: {
          appointmentServiceUuid: string;
          appointmentLocationUuid: string;
          queueUuid: string;
        }) => ({ appointmentServiceUuid, appointmentLocationUuid, queueUuid }),
      );

    expect(queueConfig).toEqual({
      careRoutingContractVersion: appointmentsConfig.careRoutingContractVersion,
      appointmentVisitAttributeTypeUuid: appointmentsConfig.appointmentVisitAttributeTypeUuid,
      triageRouting: appointmentsConfig.triageRouting,
      appointmentArrivalRules,
    });
  });
});
