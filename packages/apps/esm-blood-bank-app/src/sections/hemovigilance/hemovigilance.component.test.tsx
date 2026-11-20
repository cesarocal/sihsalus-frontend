import { showSnackbar } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import spanish from '../../../translations/es.json';
import { transfusionRequestsMock } from '../../mocks/transfusions.mock';
import { printDocument } from '../../shared/print-document';
import { localDateTime } from '../laboratory/screening/screening-rules';
import type { UnitCase } from './hemovigilance';
import { HemovigilanceChart } from './hemovigilance.component';
import { listPatientHemovigilance, saveHemovigilance, searchPremedications } from './hemovigilance.resource';

const session = vi.hoisted(() => ({ physician: false }));
vi.mock('@openmrs/esm-framework', () => ({
  useConfig: () => ({ useMockData: true }),
  useSession: () => ({
    authenticated: true,
    user: {
      person: {
        uuid: session.physician ? 'doctor' : 'nurse',
        preferredName: { givenName: session.physician ? 'Médico' : 'Enfermera', familyName: 'Ejemplo' },
      },
    },
  }),
  useDebounce: (value: string) => value,
  userHasAccess: (access: string | string[]) =>
    Array.isArray(access) || (session.physician ? access.endsWith('.revisar') : !access.endsWith('.revisar')),
  showSnackbar: vi.fn(),
}));

vi.mock('./hemovigilance.resource', () => ({
  isLocalHemovigilance: () => true,
  listPatientHemovigilance: vi.fn(),
  saveHemovigilance: vi.fn(),
  hemovigilanceSaveError: () => 'saveFailed',
  actorLicense: async () => (session.physician ? 'CMP-1234' : 'CEP-5678'),
  searchPremedications: vi.fn(),
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
  await act(async () => fireEvent.click(within(row).getByRole('button', { name: 'Hoja de conducción' })));
  return screen.getByRole('dialog', { name: 'Hoja de conducción de la unidad UNIT-20' });
}

describe('nursing transfusion monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.physician = false;
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
    expect(row('UNIT-19').getByText('En curso')).toBeVisible();
    expect(row('UNIT-COMPLETED').getByText('Completada')).toBeVisible();
    expect(row('UNIT-STOPPED').getByText('Interrumpida')).toBeVisible();
    expect(row('UNIT-STOPPED').getByText('Reportada')).toBeVisible();
    expect(row('UNIT-COMPLETED').getByText('Sin reporte')).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado de transfusión' }), {
      target: { value: 'transfusionInterrupted' },
    });
    expect(row('UNIT-STOPPED').getByText('Interrumpida')).toBeVisible();
    expect(screen.queryByRole('row', { name: /UNIT-COMPLETED/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar por solicitud/ }), {
      target: { value: 'UNIT-20' },
    });
    expect(screen.getByText('No hay unidades que coincidan con la búsqueda y los filtros.')).toBeVisible();
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
    expect(dialog.queryByRole('button', { name: 'Imprimir hoja' })).toBeNull();
  });

  it('confirms the handoff to the physician and locks the sheet after saving the end time', async () => {
    const sheet = await openSheet();
    const dialog = within(sheet);
    const save = dialog.getByRole('button', { name: 'Guardar registro' });

    fireEvent.change(dialog.getByLabelText('Hora de inicio'), { target: { value: '00:00' } });
    fireEvent.change(dialog.getByLabelText('Hora 1'), { target: { value: '00:05' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Añadir hora de control' }));
    fireEvent.change(dialog.getByLabelText('Hora 2'), { target: { value: '12:00' } });
    fireEvent.click(save);
    await waitFor(() => expect(showSnackbar).toHaveBeenCalledTimes(1));
    expect(sheet).toBeVisible();

    const antecedentes = within(dialog.getByRole('region', { name: 'Antecedentes' }));
    const reactions = within(dialog.getByRole('region', { name: 'Reacciones adversas' }));
    fireEvent.click(antecedentes.getByRole('checkbox', { name: 'Alergia a medicamentos' }));
    fireEvent.click(reactions.getByRole('checkbox', { name: 'Urticaria' }));
    fireEvent.change(dialog.getByLabelText('Hora de término'), { target: { value: '13:30' } });
    fireEvent.click(save);
    const confirm = within(screen.getByRole('dialog', { name: 'Enviar Hoja de conducción a revisión' }));
    expect(saveHemovigilance).toHaveBeenCalledTimes(1);
    fireEvent.click(confirm.getByRole('button', { name: 'Guardar y enviar' }));
    await waitFor(() => expect(dialog.getByLabelText('Talla (cm)')).toHaveAttribute('readonly'));
    expect(sheet).toBeVisible();
    const markedHistory = antecedentes.getByRole('checkbox', { name: 'Alergia a medicamentos', checked: true });
    expect(markedHistory).toHaveAttribute('aria-readonly', 'true');
    expect(antecedentes.getByRole('checkbox', { name: 'Uso de drogas EV', checked: false })).toBeVisible();
    expect(reactions.getByRole('checkbox', { name: 'Urticaria', checked: true })).toBeVisible();
    expect(reactions.getByRole('checkbox', { name: 'Tos', checked: false })).toBeVisible();
    fireEvent.click(markedHistory);
    expect(markedHistory).toBeChecked();
    expect(saveHemovigilance).toHaveBeenCalledTimes(2);
    expect(dialog.queryByRole('button', { name: 'Guardar registro' })).toBeNull();
    expect(dialog.queryByRole('button', { name: 'Imprimir hoja' })).toBeNull();
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hoja de conducción guardada y disponible para revisión médica.',
        kind: 'success',
      }),
    );
    fireEvent.click(dialog.getAllByRole('button', { name: 'Cerrar' })[0]);
    await waitFor(() => expect(screen.getByRole('row', { name: /UNIT-20/ })).toBeVisible());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('prints the saved monitoring sheet for a physician', async () => {
    session.physician = true;
    vi.mocked(listPatientHemovigilance).mockResolvedValue([
      {
        ...unit,
        sections: {
          conduction: {
            ...past.sections.conduction,
            fields: {
              ...past.sections.conduction.fields,
              startTime: '00:00',
              endTime: '13:30',
              time0: '00:05',
              time1: '12:00',
            },
          },
        },
      },
    ]);
    const dialog = within(await openSheet());
    fireEvent.click(dialog.getByRole('button', { name: 'Imprimir hoja' }));
    const [document, title] = vi.mocked(printDocument).mock.calls[0];
    expect(title).toBe('Hoja de conducción: HC-ORD-20-UNIT-20');
    const printed = render(document);
    expect(screen.getByRole('heading', { level: 1, name: 'Hoja de conducción: HC-ORD-20-UNIT-20' })).toBeVisible();
    const printedSheet = within(printed.getByRole('article'));
    expect(printedSheet.getByText(new RegExp(`Nombre y apellido.*${unit.order.patientName}`))).toBeVisible();
    expect(printedSheet.getByText(/N.º de historia clínica/)).toBeVisible();
    expect(printedSheet.getByRole('img', { name: 'Hospital Santa Clotilde' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/png;base64,/),
    );
    expect(printedSheet.queryByText(/Asociación Civil Pango|Lote de bolsa|Cantidad transfundida/)).toBeNull();
    expect(printedSheet.queryByRole('img', { name: 'Pango' })).toBeNull();
    expect(printedSheet.queryByRole('heading', { name: 'Solicitud transfusional' })).toBeNull();
    expect(printedSheet.getByText('12:00 AM')).toBeVisible();
    expect(printedSheet.getByText('01:30 PM')).toBeVisible();
    const monitoring = within(printedSheet.getByRole('table', { name: 'Conducción de la transfusión' }));
    const times = within(monitoring.getAllByRole('row')[0]);
    expect(times.getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '12:05 AM',
      '12:00 PM',
      '',
      '',
      '',
      '',
    ]);
  });

  it('leaves the sheet and its values open when saving fails', async () => {
    vi.mocked(saveHemovigilance).mockRejectedValueOnce(new Error('Test rejection'));
    const dialog = within(await openSheet());
    fireEvent.change(dialog.getByLabelText('Hora de inicio'), { target: { value: '09:30' } });
    fireEvent.change(dialog.getByLabelText('Hora 1'), { target: { value: '09:35' } });
    fireEvent.change(dialog.getByLabelText('Hora de término'), { target: { value: '10:30' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar registro' }));
    const confirm = within(screen.getByRole('dialog', { name: 'Enviar Hoja de conducción a revisión' }));
    fireEvent.click(confirm.getByRole('button', { name: 'Guardar y enviar' }));
    expect(await confirm.findByText(/^No se pudo guardar el registro/)).toBeVisible();
    expect(dialog.getByLabelText('Hora de término')).toHaveValue('10:30');
    expect(dialog.getByLabelText('Hora de término')).not.toHaveAttribute('readonly');
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('requires ordered controls and saved start and end times before reporting a reaction', async () => {
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
    expect(dialog.getByText(/^Guarde la hora de inicio y la hora de término/)).toBeVisible();
    expect(dialog.queryByLabelText('Hora de suspensión')).not.toBeInTheDocument();
    fireEvent.change(dialog.getByRole('spinbutton', { name: 'Presión sistólica (mmHg) 1' }), {
      target: { value: '120' },
    });
    fireEvent.change(dialog.getByRole('spinbutton', { name: 'Presión diastólica (mmHg) 1' }), {
      target: { value: '80' },
    });
    fireEvent.change(dialog.getByLabelText('Hora de término'), { target: { value: '10:10' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar registro' }));
    const send = within(screen.getByRole('dialog', { name: 'Enviar Hoja de conducción a revisión' }));
    fireEvent.click(send.getByRole('button', { name: 'Guardar y enviar' }));
    await waitFor(() => expect(showSnackbar).toHaveBeenCalled());
    fireEvent.click(dialog.getByRole('button', { name: 'Reportar reacción adversa' }));
    const report = within(await screen.findByRole('dialog', { name: 'Reporte de reacción FR02: UNIT-20' }));
    expect(report.getByLabelText('Hora de inicio')).toHaveValue('09:30');
    expect(report.getByLabelText('Hora de inicio')).toHaveAttribute('readonly');
    expect(report.getByLabelText('Hora de suspensión')).toHaveValue('10:10');
    expect(report.getByLabelText('Hora de suspensión')).toHaveAttribute('readonly');
    expect(report.queryByLabelText('Hora de notificación al Banco de Sangre')).toBeNull();
    expect(report.getByLabelText('Cantidad transfundida (mL)')).toBeVisible();
    expect(report.queryByRole('button', { name: 'Imprimir FR08' })).toBeNull();
    expect(saveHemovigilance).toHaveBeenCalledWith(
      unit,
      'conduction',
      expect.objectContaining({
        cardiovascular: 'normal',
        time5: '10:06',
        endTime: '10:10',
        systolicPressure0: '120',
        diastolicPressure0: '80',
        weight: '60',
        responsiblePhysician: 'Doctora Ejemplo',
        physicianRegistration: 'CMP-1234',
      }),
      expect.objectContaining({ personUuid: 'nurse' }),
    );
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success', isLowContrast: true }));
    expect(report.getByText('CEP-5678')).toBeVisible();
    vi.mocked(searchPremedications).mockResolvedValue([{ uuid: 'drug', display: 'Paracetamol', retired: false }]);
    fireEvent.change(report.getByRole('searchbox', { name: 'Premedicación previa a transfusión' }), {
      target: { value: 'para' },
    });
    fireEvent.click(await report.findByRole('button', { name: 'Paracetamol' }));
    vi.mocked(searchPremedications).mockResolvedValue([{ uuid: 'drug2', display: 'Loratadina', retired: false }]);
    fireEvent.change(report.getByRole('searchbox', { name: 'Premedicación previa a transfusión' }), {
      target: { value: 'lora' },
    });
    fireEvent.click(await report.findByRole('button', { name: 'Loratadina' }));
    fireEvent.change(report.getByLabelText('Cantidad transfundida (mL)'), { target: { value: '100' } });
    fireEvent.change(report.getByLabelText('Número de cama'), { target: { value: 'Cama 5' } });
    expect(report.getByRole('group', { name: 'Presión arterial (mmHg)' })).toBeVisible();
    expect(report.getByRole('group', { name: 'Frecuencia del pulso (ppm)' })).toBeVisible();
    expect(report.getByRole('group', { name: 'Frecuencia respiratoria (rpm)' })).toBeVisible();
    for (const [name, value] of [
      ['Sistólica · Pre', '120'],
      ['Diastólica · Pre', '80'],
      ['Sistólica · Post', '130'],
      ['Diastólica · Post', '85'],
    ]) {
      fireEvent.change(report.getByRole('spinbutton', { name }), { target: { value } });
    }
    fireEvent.click(report.getByRole('button', { name: 'Guardar registro' }));
    await waitFor(() =>
      expect(saveHemovigilance).toHaveBeenCalledWith(
        expect.anything(),
        'report',
        expect.objectContaining({
          'premedication:drug': 'Paracetamol',
          'premedication:drug2': 'Loratadina',
          bed: 'Cama 5',
          transfused: '100',
          systolicBefore: '120',
          diastolicBefore: '80',
          systolicAfter: '130',
          diastolicAfter: '85',
        }),
        expect.objectContaining({ license: 'CEP-5678' }),
      ),
    );
  });

  it('keeps Bank notification off the physician screen and includes it in the printable FR02', async () => {
    session.physician = true;
    const reportAt = '2026-11-19T11:10:00Z';
    const reviewedAt = '2026-11-19T13:00:00Z';
    vi.mocked(listPatientHemovigilance).mockResolvedValue([
      {
        ...unit,
        dispatch: { ...unit.dispatch, component: 'lowVolumeRedCells' },
        sections: {
          report: {
            ...past.sections.conduction,
            at: reportAt,
            actor: { ...past.sections.conduction.actor, license: '5678' },
            fields: {
              startTime: '09:30',
              stopTime: '10:10',
              bed: 'Cama 5',
              systolicBefore: '120',
              diastolicBefore: '80',
              systolicAfter: '130',
              diastolicAfter: '85',
              chills: 'yes',
              sepsis: 'yes',
              premedication: 'Premedicación anterior',
            },
          },
        },
      },
    ]);
    const sheet = within(await openSheet());
    fireEvent.click(sheet.getByRole('button', { name: 'Ver reporte de reacción adversa' }));
    const report = within(await screen.findByRole('dialog', { name: 'Reporte de reacción FR02: UNIT-20' }));
    expect(report.getByLabelText('Número de cama')).toHaveAttribute('readonly');
    expect(report.getByLabelText('Hora de notificación al médico')).toHaveValue(
      localDateTime(new Date(reportAt)).slice(11, 16),
    );
    expect(report.queryByLabelText('Hora de notificación al Banco de Sangre')).not.toBeInTheDocument();
    const symptoms = within(report.getByRole('region', { name: 'Síntomas clínicos' }));
    expect(symptoms.getByRole('checkbox', { name: 'Escalofríos', checked: true })).toHaveAttribute(
      'aria-readonly',
      'true',
    );
    expect(symptoms.getByRole('checkbox', { name: 'Cianosis', checked: false })).toBeVisible();
    const conditions = within(report.getByRole('region', { name: 'Paciente se encuentra en' }));
    expect(conditions.getByRole('checkbox', { name: 'Sepsis', checked: true })).toHaveAttribute(
      'aria-readonly',
      'true',
    );
    expect(conditions.getByRole('checkbox', { name: 'CID', checked: false })).toBeVisible();
    expect(report.getByRole('spinbutton', { name: 'Sistólica · Pre' })).toHaveAttribute('readonly');
    expect(report.queryByRole('button', { name: 'Revisión médica' })).toBeNull();
    expect(report.queryByRole('button', { name: 'Reporte de reacción FR02' })).toBeNull();
    expect(report.queryByLabelText('Observaciones de la revisión médica')).toBeNull();
    expect(report.getByText('CMP-1234')).toBeVisible();
    expect(report.getByText('Premedicación anterior')).toBeVisible();
    const print = report.getByRole('button', { name: 'Imprimir FR02' });
    expect(print).toBeDisabled();
    const review = report.getByRole('button', { name: 'Registrar revisión' });
    await waitFor(() => expect(review).toBeEnabled());
    fireEvent.click(review);
    const confirmation = within(screen.getByRole('dialog', { name: 'Confirmar revisión del FR02' }));
    expect(confirmation.getByText('El reporte pasará al estado Revisada.')).toBeVisible();
    expect(saveHemovigilance).not.toHaveBeenCalled();
    fireEvent.click(confirmation.getByRole('button', { name: 'Registrar revisión' }));
    await waitFor(() => expect(print).toBeEnabled());
    expect(report.queryByLabelText('Hora de notificación al Banco de Sangre')).not.toBeInTheDocument();
    expect(saveHemovigilance).toHaveBeenCalledWith(
      expect.anything(),
      'review',
      {},
      expect.objectContaining({ license: 'CMP-1234' }),
    );
    fireEvent.click(print);
    fireEvent.click(print);
    expect(printDocument).toHaveBeenCalledTimes(2);
    const [document] = vi.mocked(printDocument).mock.calls[0];
    const printed = within(render(document).getByRole('article'));
    const bankTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(reviewedAt));
    expect(printed.getByText('Hora de notificación al Banco de Sangre').parentElement).toHaveTextContent(bankTime);
    expect(printed.getByText('Presión arterial (mmHg)').parentElement).toHaveTextContent(
      /Pre: 120\/80\s*Post: 130\/85/,
    );
    expect(printed.getByText('Frecuencia respiratoria (rpm)')).toBeVisible();
    expect(printed.getByText('Frecuencia del pulso (ppm)')).toBeVisible();
    expect(printed.getByText('Enfermera Ejemplo - CEP 5678').parentElement).toHaveClass('fr02Signer');
    expect(printed.getByText(/^Médico Ejemplo - CMP /).parentElement).toHaveClass('fr02Signer');
    expect(printed.getByText(/Otros: Glóbulos Rojos de Bajo Volumen/i)).toBeVisible();
    expect(printed.queryByText('FR08 ORD-20')).not.toBeInTheDocument();
    expect(printed.getByText('AM/PM').previousElementSibling).toHaveTextContent(/^:$/);
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
    const options = within(field).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Normal',
      'Infarto de miocardio, HTA, valvulopatía o angina',
    ]);
    expect(dialog.getByText('Sin determinar')).toBeVisible();
  });
});
