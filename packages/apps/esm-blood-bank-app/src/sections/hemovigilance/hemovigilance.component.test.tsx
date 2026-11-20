import { showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import spanish from '../../../translations/es.json';
import { transfusionRequestsMock } from '../../mocks/transfusions.mock';
import { printDocument } from '../../shared/print-document';
import { localDateTime } from '../laboratory/screening/screening-rules';
import type { UnitCase } from './hemovigilance';
import { HemovigilanceChart } from './hemovigilance.component';
import { listPatientHemovigilance, saveHemovigilance } from './hemovigilance.resource';

vi.mock('@openmrs/esm-framework', () => ({
  useConfig: () => ({ useMockData: true }),
  useSession: () => ({
    authenticated: true,
    user: { person: { uuid: 'nurse', preferredName: { givenName: 'Enfermera', familyName: 'Ejemplo' } } },
  }),
  userHasAccess: () => true,
  showSnackbar: vi.fn(),
}));

vi.mock('./hemovigilance.resource', () => ({
  isLocalHemovigilance: () => true,
  listPatientHemovigilance: vi.fn(),
  saveHemovigilance: vi.fn(),
  actorLicense: async () => '',
}));

vi.mock('../../shared/print-document', () => ({ printDocument: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: string | (Record<string, string> & { defaultValue: string })) => {
      const [namespace, name] = key.split('.');
      const catalog = spanish as unknown as Record<string, Record<string, string>>;
      return (catalog[namespace]?.[name] ?? (typeof options === 'string' ? options : options.defaultValue)).replace(
        /\{\{(\w+)\}\}/g,
        (match, token: string) => (typeof options === 'object' ? (options[token] ?? match) : match),
      );
    },
  }),
}));

const unit: UnitCase = {
  order: {
    ...transfusionRequestsMock()[0].order,
    number: 'ORD-20',
    orderer: 'Doctora Ejemplo',
    doctorLicense: 'CMP-1234',
  },
  dispatch: {
    unitCode: 'UNIT-20',
    lot: 'LOT-20',
    component: 'redCells',
    bloodGroup: 'O+',
    seal: 'SEAL-20',
    deliveredAt: '2026-11-19T12:00:00Z',
  },
  sections: {},
};
const past = {
  ...unit,
  order: { ...unit.order, id: 'order19', number: 'ORD-19' },
  dispatch: { ...unit.dispatch, unitCode: 'UNIT-19', deliveredAt: '2026-11-18T12:00:00Z' },
  deliveryLocation: 'Hospital Ejemplo',
  sections: {
    conduction: {
      uuid: 'conduction19',
      at: '2026-11-18T13:00:00Z',
      actor: { personUuid: 'nurse', name: 'Enfermera Ejemplo', license: '' },
      fields: { conductionDate: '2026-11-18', startTime: '12:30', fever: 'yes', hives: 'yes' },
    },
  },
} satisfies UnitCase;

async function openSheet() {
  render(<HemovigilanceChart patientUuid={unit.order.patientId} />);
  const row = await screen.findByRole('row', { name: /UNIT-20/ });
  fireEvent.click(within(row).getByRole('button', { name: 'Hoja de conducción' }));
  return screen.getByRole('dialog', { name: 'Hoja de conducción de la unidad UNIT-20' });
}

describe('nursing transfusion monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPatientHemovigilance).mockResolvedValue([
      unit,
      past,
      { ...past, dispatch: { ...past.dispatch, unitCode: 'DELIVERY-ONLY' }, sections: {} },
    ]);
    vi.mocked(saveHemovigilance).mockImplementation(async (_unit, _stage, fields, actor) => ({
      uuid: 'conduction20',
      at: '2026-11-19T13:00:00Z',
      fields,
      actor,
    }));
  });

  it('shows transfusion progress per unit independently of the FR02 status', async () => {
    const conduction = past.sections.conduction;
    const finished = { ...conduction, fields: { ...conduction.fields, endTime: '13:15' } };
    const interruption = { ...conduction, fields: { startTime: '12:30', stopTime: '13:15' } };
    vi.mocked(listPatientHemovigilance).mockResolvedValue([
      unit,
      past,
      { ...unit, dispatch: { ...unit.dispatch, unitCode: 'UNIT-COMPLETED' }, sections: { conduction: finished } },
      {
        ...unit,
        dispatch: { ...unit.dispatch, unitCode: 'UNIT-STOPPED' },
        sections: { conduction: finished, report: interruption },
      },
    ]);

    render(<HemovigilanceChart patientUuid={unit.order.patientId} />);
    await screen.findByRole('columnheader', { name: 'Estado de transfusión' });
    const row = (code: string) => within(screen.getByRole('row', { name: new RegExp(code) }));
    expect(row('UNIT-20').getByRole('cell', { name: '—' })).toBeVisible();
    expect(row('UNIT-19').getByText('Transfusión en curso')).toBeVisible();
    expect(row('UNIT-COMPLETED').getByText('Completada')).toBeVisible();
    expect(row('UNIT-STOPPED').getByText('Interrumpida')).toBeVisible();
    expect(row('UNIT-STOPPED').getByText('Reportada')).toBeVisible();
    expect(row('UNIT-COMPLETED').getByText('Sin reporte')).toBeVisible();
  });

  it('shows FR08 and prior conduction data and lets nursing add a manual transfusion', async () => {
    const dialog = within(await openSheet());
    expect(dialog.getByRole('heading', { name: 'Hoja de conducción: HC-ORD-20-UNIT-20' })).toBeVisible();
    expect(dialog.getByText(localDateTime().slice(0, 10).split('-').reverse().join('/'))).toBeVisible();
    expect(dialog.getByText('Doctora Ejemplo')).toBeVisible();
    expect(dialog.getByText('CMP-1234')).toBeVisible();
    expect(dialog.getByRole('heading', { name: 'Solicitud transfusional' })).toBeVisible();
    expect(dialog.queryByLabelText('Cantidad transfundida (mL)')).toBeNull();
    expect(dialog.queryByRole('button', { name: /^Imprimir$/ })).toBeNull();
    expect(dialog.getByRole('row', { name: /UNIT-19.*Fiebre, Urticaria.*Hospital Ejemplo/ })).toBeVisible();
    expect(dialog.queryByText('DELIVERY-ONLY')).toBeNull();
    expect(dialog.queryByRole('button', { name: 'Hoja de conducción' })).toBeNull();
    fireEvent.click(dialog.getByRole('button', { name: 'Añadir transfusión previa' }));
    fireEvent.change(dialog.getByLabelText('Código de la unidad 1'), { target: { value: 'MANUAL-UNIT' } });
    fireEvent.change(dialog.getByRole('combobox', { name: 'Componente 1' }), { target: { value: 'redCells' } });
    expect(dialog.getByLabelText('Código de la unidad 1')).toHaveValue('MANUAL-UNIT');
    expect(dialog.getByLabelText('Componente 1')).toHaveValue('redCells');
    expect(dialog.getByLabelText('Lugar 1')).toHaveAttribute('placeholder', 'Lugar');
    fireEvent.click(dialog.getByRole('button', { name: 'Imprimir hoja' }));
    const [document, title] = vi.mocked(printDocument).mock.calls[0];
    expect(title).toBe('Hoja de conducción: HC-ORD-20-UNIT-20');
    render(document);
    expect(screen.getByRole('heading', { level: 1, name: 'Hoja de conducción: HC-ORD-20-UNIT-20' })).toBeVisible();
    expect(screen.queryByText('MANUAL-UNIT')).toBeNull();
    const printedSheet = within(screen.getByRole('article'));
    expect(printedSheet.getByText(/N.º de historia clínica/)).toBeVisible();
    expect(printedSheet.queryByText(/Asociación Civil Pango|Lote de bolsa|Cantidad transfundida/)).toBeNull();
    expect(printedSheet.queryByRole('img', { name: 'Pango' })).toBeNull();
    expect(printedSheet.queryByRole('heading', { name: 'Solicitud transfusional' })).toBeNull();
    const monitoring = within(printedSheet.getByRole('table', { name: 'Conducción de la transfusión' }));
    expect(within(monitoring.getAllByRole('row')[0]).getAllByRole('cell')).toHaveLength(6);
  });

  it('requires ordered times, caps the table at six, and saves before going to the FR02', async () => {
    const sheet = await openSheet();
    const dialog = within(sheet);
    fireEvent.change(dialog.getByLabelText('Hora de inicio'), { target: { value: '09:30' } });
    fireEvent.change(dialog.getByLabelText('Peso (kg)'), { target: { value: '60' } });
    expect(dialog.queryByLabelText('Hora 2')).toBeNull();
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar registro' }));
    expect(dialog.getByText('Indique la hora de cada columna de control.')).toBeVisible();
    fireEvent.change(dialog.getByLabelText('Hora 1'), { target: { value: '10:00' } });
    const add = dialog.getByRole('button', { name: 'Añadir hora de control' });
    fireEvent.click(add);
    fireEvent.change(dialog.getByLabelText('Hora 2'), { target: { value: '10:01' } });
    fireEvent.change(dialog.getByLabelText('Hora 1'), { target: { value: '10:05' } });
    expect(dialog.getByLabelText('Hora 2')).toHaveValue('10:01');
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar registro' }));
    expect(dialog.getByRole('status')).toHaveTextContent('Las horas de control deben estar en orden ascendente.');
    fireEvent.change(dialog.getByLabelText('Hora 1'), { target: { value: '10:00' } });
    for (let column = 3; column <= 6; column++) {
      fireEvent.click(add);
      fireEvent.change(dialog.getByLabelText(`Hora ${column}`), { target: { value: `10:0${column}` } });
    }
    expect(add).toBeDisabled();
    expect(dialog.queryByLabelText('Hora 7')).toBeNull();
    const cardiovascular = within(dialog.getByRole('combobox', { name: 'Estado cardiovascular' }));
    fireEvent.change(dialog.getByRole('combobox', { name: 'Estado cardiovascular' }), {
      target: { value: cardiovascular.getByRole<HTMLOptionElement>('option', { name: 'Normal' }).value },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Reportar reacción adversa' }));
    const confirm = within(screen.getByRole('dialog', { name: '¿Desea cambiar de sección?' }));
    expect(confirm.getByLabelText('Guardar el avance antes de salir')).toBeChecked();
    fireEvent.click(confirm.getByRole('button', { name: 'Salir' }));
    const report = within(await screen.findByRole('dialog', { name: 'Reporte de reacción FR02: UNIT-20' }));
    expect(report.getByLabelText('Hora de inicio')).toHaveValue('09:30');
    expect(report.getByLabelText('Cantidad transfundida (mL)')).toBeVisible();
    expect(report.queryByRole('button', { name: 'Imprimir FR08' })).toBeNull();
    expect(saveHemovigilance).toHaveBeenCalledWith(
      unit,
      'conduction',
      expect.objectContaining({
        cardiovascular: 'normal',
        time5: '10:06',
        weight: '60',
        responsiblePhysician: 'Doctora Ejemplo',
        physicianRegistration: 'CMP-1234',
      }),
      expect.objectContaining({ personUuid: 'nurse' }),
    );
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success', isLowContrast: true }));
  });

  it('asks what to do on X and keeps changes until the user decides', async () => {
    const dialog = within(await openSheet());
    fireEvent.change(dialog.getByLabelText('Talla (cm)'), { target: { value: '160' } });
    fireEvent.click(dialog.getAllByRole('button', { name: 'Cerrar' })[0]);
    const confirmation = () => within(screen.getByRole('dialog', { name: '¿Desea salir del proceso?' }));
    fireEvent.click(confirmation().getByRole('button', { name: 'Seguir editando' }));
    expect(dialog.getByLabelText('Talla (cm)')).toHaveValue(160);
    fireEvent.click(dialog.getAllByRole('button', { name: 'Cerrar' })[0]);
    fireEvent.click(confirmation().getByLabelText('Guardar el avance antes de salir'));
    fireEvent.click(confirmation().getByRole('button', { name: /Salir/ }));
    expect(screen.queryByRole('dialog', { name: 'Hoja de conducción de la unidad UNIT-20' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('row', { name: /UNIT-20/ })).toBeVisible());
    expect(saveHemovigilance).not.toHaveBeenCalled();
  });

  it('displays a historical undetermined status outside the current choices', async () => {
    const previous = past.sections.conduction;
    vi.mocked(listPatientHemovigilance).mockResolvedValue([
      {
        ...unit,
        sections: { conduction: { ...previous, fields: { ...previous.fields, cardiovascular: 'undetermined' } } },
      },
    ]);
    const dialog = within(await openSheet());
    const field = dialog.getByRole('combobox', { name: 'Estado cardiovascular' });
    expect(field).toHaveValue('');
    expect(within(field).queryByRole('option', { name: 'Sin determinar' })).toBeNull();
    expect(dialog.getByText('Sin determinar')).toBeVisible();
  });
});
