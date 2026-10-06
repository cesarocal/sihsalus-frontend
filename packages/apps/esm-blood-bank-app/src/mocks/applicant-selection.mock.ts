import { interviewQuestions } from '../sections/applicant-selection/selection-fields';
import { calculateReturnDate, newApplication, today } from '../sections/applicant-selection/selection-rules';
import type { ApplicantHistory, SelectionApplication } from '../sections/applicant-selection/selection.types';

export function applicantProfilesMock(): ApplicantHistory[] {
  return [1, 2, 3].map((number) => ({
    patientUuid: `mock-person-${number}`,
    donorCode: `DEMO-00${number}`,
    documentType: 'DNI',
    documentNumber: `9000000${number}`,
    personal: {
      ...newApplication().personal,
      familyName: 'Ejemplo',
      givenName: `Persona ${number}`,
      sex: number === 2 ? 'F' : 'M',
      birthDate: '1990-03-15',
      birthPlace: 'Localidad de prueba',
      provenance: 'Localidad de prueba',
      address: 'Domicilio sintético 123',
      district: 'Napo',
      province: 'Maynas',
      department: 'Loreto',
      mobile: '900000000',
      email: `donante${number}@example.invalid`,
      occupation: 'Ocupación de prueba',
    },
    ...(number === 2 ? { exclusion: { kind: 'temporary' as const, returnDate: '2099-12-31' } } : {}),
    ...(number === 3 ? { exclusion: { kind: 'permanent' as const, returnDate: null } } : {}),
  }));
}

export function applicationsMock(): SelectionApplication[] {
  return ['admitted', 'awaitingInterview', 'selected', 'deferred'].map((status, index) => {
    const application = newApplication();
    application.id = `mock-application-${index + 1}`;
    application.number = String(index + 1).padStart(6, '0');
    application.revision = 1;
    application.status = status as SelectionApplication['status'];
    application.admission = {
      ...application.admission,
      documentNumber: `9000001${index}`,
      donationType: 'voluntary',
      modality: status === 'admitted' ? 'apheresis' : 'wholeBlood',
    };
    application.personal = {
      ...applicantProfilesMock()[0].personal,
      givenName: `Postulante ${index + 1}`,
      familyName: 'Demostración',
    } as SelectionApplication['personal'];
    application.completedSteps = status === 'admitted' ? ['admission'] : ['admission', 'personal', 'physical'];
    application.physical = {
      ...application.physical,
      weight: '70',
      height: '170',
      systolic: '120',
      diastolic: '80',
      pulse: '72',
      temperature: '36.5',
      hemoglobin: '14',
      hematocrit: '42',
      bloodGroup: 'O',
      rh: '+',
      armInspection: 'normal',
    };
    application.updatedAt = `${today()}T10:00:00`;
    if (status === 'selected' || status === 'deferred') {
      application.completedSteps.push('interview', 'qualification', 'review');
      application.interview.answers = Object.fromEntries(
        interviewQuestions.map(({ id }) => [
          id,
          ['understoodInformation', 'over18', 'over50kg', 'feelsWell'].includes(id) ? 'yes' : 'no',
        ]),
      );
      application.qualification = {
        ...application.qualification,
        result: status === 'selected' ? 'eligible' : 'temporary',
        duration: '30',
        reason: status === 'deferred' ? 'Motivo sintético de evaluación' : '',
        applicantName: `${application.personal.givenName} ${application.personal.familyName}`,
        interviewerName: 'Profesional de prueba',
        interviewerLicense: 'DEMO-000',
        validatedBy: 'Validador de prueba',
      };
      if (status === 'deferred') application.returnDate = calculateReturnDate(application.admission.date, '30', 'days');
    }
    return application;
  });
}
