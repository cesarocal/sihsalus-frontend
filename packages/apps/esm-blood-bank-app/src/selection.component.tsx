import { Button, Checkbox, InlineNotification, Select, SelectItem, TextArea, TextInput, Tile } from '@carbon/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from './constants';
import type { SelectionDecision, SelectionDraft } from './types';
import styles from './root.scss';

const emptyDraft: SelectionDraft = {
  applicationNumber: 'POST-02482',
  donorCode: '',
  interviewDate: '2026-09-08',
  bloodGroup: '',
  rhFactor: '',
  documentType: 'dni',
  documentNumber: '',
  donationType: 'voluntary',
  procedureType: 'whole-blood',
  familyName: '',
  givenName: '',
  sex: '',
  birthDate: '',
  phone: '',
  address: '',
  placeOfBirth: '',
  origin: '',
  district: '',
  province: '',
  department: '',
  civilStatus: '',
  occupation: '',
  email: '',
  workplace: '',
  permanence: '',
  weight: '',
  height: '',
  bloodPressure: '',
  pulse: '',
  generalAppearance: '',
  venousAccess: '',
  answers: {},
  answerNotes: {},
  lastMenstruation: '',
  pregnant: '',
  breastfeeding: '',
  lastBirth: '',
  pregnancyCount: '',
  decision: 'pending',
  reason: '',
  returnDate: '',
  interviewer: '',
  validator: '',
};

const questionGroups = [
  {
    key: 'generalQuestions',
    fallback: 'Condiciones generales',
    questions: [
      ['age', '¿Tiene 18 años o más?'],
      ['weight', '¿Pesa 50 kg o más?'],
      ['recentDonation', '¿Ha donado sangre en los últimos doce meses?'],
      ['medication', '¿Está tomando o tomó algún medicamento recientemente?'],
      ['medicalWaitingList', '¿Está actualmente en lista de espera para una cita médica?'],
      ['health', '¿Se encuentra en buen estado de salud?'],
    ],
  },
  {
    key: 'next24Hours',
    fallback: 'En las próximas 24 horas',
    questions: [['riskActivity', '¿Realizará actividad laboral, deportiva u otra actividad riesgosa?']],
  },
  {
    key: 'lastTwoWeeks',
    fallback: 'En las últimas dos semanas',
    questions: [['symptoms', '¿Ha presentado fiebre, dolor de cabeza o evidencia de enfermedad?']],
  },
  {
    key: 'lastMonth',
    fallback: 'En el último mes',
    questions: [
      ['vaccination', '¿Recibió alguna vacuna?'],
      ['contagiousContact', '¿Tuvo contacto con una persona portadora de una enfermedad contagiosa?'],
    ],
  },
  {
    key: 'lastTwelveMonths',
    fallback: 'En los últimos doce meses',
    questions: [
      ['bloodExposure', '¿Tuvo tatuajes, perforaciones o contacto accidental con sangre?'],
      ['surgery', '¿Tuvo intervenciones quirúrgicas?'],
    ],
  },
  {
    key: 'lifetimeQuestions',
    fallback: 'En alguna ocasión durante su vida',
    questions: [['controlledDisease', '¿Tiene alguna enfermedad o molestia que requiere control?']],
  },
  {
    key: 'advisorQuestions',
    fallback: 'Con asesoría del entrevistador',
    questions: [
      ['infectionConcern', '¿Cree que podría tener VIH, hepatitis B o hepatitis C?'],
      ['illicitDrugs', '¿Alguna vez usó drogas ilícitas endovenosas u otras?'],
      ['sexualRisk', '¿Tuvo conducta sexual de riesgo en el último año?'],
      ['hivTest', '¿Se realizó alguna prueba de descarte de VIH?'],
      ['intimateContact', '¿Tuvo relaciones íntimas con personas diagnosticadas con hepatitis B, hepatitis C o VIH?'],
      ['sexuallyTransmittedInfection', '¿Tuvo alguna enfermedad de transmisión sexual?'],
    ],
  },
] as const;

const totalQuestions = questionGroups.reduce((total, group) => total + group.questions.length, 0);

export function Selection() {
  const { t } = useTranslation(moduleName);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SelectionDraft>(emptyDraft);
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);

  const steps = [
    t('identificationStep', 'Identificación'),
    t('personalDataStep', 'Datos personales'),
    t('physicalExamStep', 'Examen físico'),
    t('interviewStep', 'Entrevista'),
    t('prequalificationStep', 'Pre-calificación'),
    t('reviewStep', 'Revisión'),
  ];

  const update = <K extends keyof SelectionDraft>(key: K, value: SelectionDraft[K]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateAnswer = (key: string, value: string) => {
    setSaved(false);
    setDraft((current) => ({ ...current, answers: { ...current.answers, [key]: value } }));
  };

  const updateAnswerNote = (key: string, value: string) => {
    setSaved(false);
    setDraft((current) => ({ ...current, answerNotes: { ...current.answerNotes, [key]: value } }));
  };

  return (
    <div className={styles.pageStack}>
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t('selectionForm', 'Formato de selección del postulante')}</p>
            <h2>{steps[step]}</h2>
          </div>
        </div>

        <ol className={styles.steps} aria-label={t('formProgress', 'Progreso del formulario')}>
          {steps.map((label, index) => (
            <li className={index === step ? styles.activeStep : index < step ? styles.completeStep : ''} key={label}>
              <button type="button" onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined}>
                <span>{index + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.sectionCard}>
        {step === 0 && (
          <div className={styles.formGrid}>
            <TextInput id="application-number" labelText={t('applicationNumber', 'Número de postulante')} value={draft.applicationNumber} onChange={(event) => update('applicationNumber', event.target.value)} />
            <TextInput id="donor-code" labelText={t('donorCode', 'Código de donante')} value={draft.donorCode} onChange={(event) => update('donorCode', event.target.value)} />
            <TextInput id="interview-date" type="date" labelText={t('interviewDate', 'Fecha de entrevista')} value={draft.interviewDate} onChange={(event) => update('interviewDate', event.target.value)} />
            <Select
              id="document-type"
              labelText={t('documentType', 'Tipo de documento')}
              value={draft.documentType}
              onChange={(event) => update('documentType', event.target.value)}>
              <SelectItem value="dni" text="DNI" />
              <SelectItem value="passport" text={t('passport', 'Pasaporte')} />
              <SelectItem value="foreign-card" text={t('foreignCard', 'Carnet de extranjería')} />
            </Select>
            <TextInput
              id="document-number"
              labelText={t('documentNumber', 'Número de documento')}
              value={draft.documentNumber}
              onChange={(event) => update('documentNumber', event.target.value)}
            />
            <Select
              id="donation-type"
              labelText={t('donationType', 'Tipo de donante')}
              value={draft.donationType}
              onChange={(event) => update('donationType', event.target.value)}>
              <SelectItem value="voluntary" text={t('voluntary', 'Voluntario')} />
              <SelectItem value="replacement" text={t('replacement', 'Reposición')} />
              <SelectItem value="autologous" text={t('autologous', 'Autólogo')} />
            </Select>
            <Select
              id="procedure-type"
              labelText={t('procedureType', 'Procedimiento previsto')}
              value={draft.procedureType}
              onChange={(event) => update('procedureType', event.target.value)}>
              <SelectItem value="whole-blood" text={t('wholeBlood', 'Sangre total')} />
              <SelectItem value="apheresis" text={t('apheresis', 'Aféresis')} />
            </Select>
            <Select id="blood-group" labelText={t('bloodGroup', 'Grupo sanguíneo')} value={draft.bloodGroup} onChange={(event) => update('bloodGroup', event.target.value)}>
              <SelectItem value="" text={t('notAvailable', 'No disponible')} />
              <SelectItem value="A" text="A" />
              <SelectItem value="B" text="B" />
              <SelectItem value="AB" text="AB" />
              <SelectItem value="O" text="O" />
            </Select>
            <Select id="rh-factor" labelText={t('rhFactor', 'Factor Rh')} value={draft.rhFactor} onChange={(event) => update('rhFactor', event.target.value)}>
              <SelectItem value="" text={t('notAvailable', 'No disponible')} />
              <SelectItem value="+" text={t('positive', '+')} />
              <SelectItem value="-" text={t('negative', '-')} />
            </Select>
            <InlineNotification
              className={styles.fullWidth}
              hideCloseButton
              kind="info"
              lowContrast
              title={t('identityCheck', 'Comprobación de identidad')}
              subtitle={t(
                'identityCheckHelp',
                'En la integración real se verificará identidad, episodios previos y exclusiones vigentes antes de continuar.',
              )}
            />
          </div>
        )}

        {step === 1 && (
          <div className={styles.formGrid}>
            <TextInput
              id="family-name"
              labelText={t('familyName', 'Apellidos')}
              value={draft.familyName}
              onChange={(event) => update('familyName', event.target.value)}
            />
            <TextInput
              id="given-name"
              labelText={t('givenName', 'Nombres')}
              value={draft.givenName}
              onChange={(event) => update('givenName', event.target.value)}
            />
            <Select id="sex" labelText={t('sex', 'Sexo')} value={draft.sex} onChange={(event) => update('sex', event.target.value)}>
              <SelectItem value="" text={t('selectOption', 'Seleccione')} />
              <SelectItem value="female" text={t('female', 'Femenino')} />
              <SelectItem value="male" text={t('male', 'Masculino')} />
            </Select>
            <TextInput
              id="birth-date"
              type="date"
              labelText={t('birthDate', 'Fecha de nacimiento')}
              value={draft.birthDate}
              onChange={(event) => update('birthDate', event.target.value)}
            />
            <TextInput
              id="phone"
              labelText={t('phone', 'Teléfono o celular')}
              value={draft.phone}
              onChange={(event) => update('phone', event.target.value)}
            />
            <TextInput
              id="address"
              labelText={t('address', 'Domicilio')}
              value={draft.address}
              onChange={(event) => update('address', event.target.value)}
            />
            <TextInput id="place-of-birth" labelText={t('placeOfBirth', 'Lugar de nacimiento')} value={draft.placeOfBirth} onChange={(event) => update('placeOfBirth', event.target.value)} />
            <TextInput id="origin" labelText={t('origin', 'Procedencia')} value={draft.origin} onChange={(event) => update('origin', event.target.value)} />
            <TextInput id="district" labelText={t('district', 'Distrito')} value={draft.district} onChange={(event) => update('district', event.target.value)} />
            <TextInput id="province" labelText={t('province', 'Provincia')} value={draft.province} onChange={(event) => update('province', event.target.value)} />
            <TextInput id="department" labelText={t('department', 'Departamento')} value={draft.department} onChange={(event) => update('department', event.target.value)} />
            <Select id="civil-status" labelText={t('civilStatus', 'Estado civil')} value={draft.civilStatus} onChange={(event) => update('civilStatus', event.target.value)}>
              <SelectItem value="" text={t('selectOption', 'Seleccione')} />
              <SelectItem value="single" text={t('single', 'Soltero/a')} />
              <SelectItem value="married" text={t('married', 'Casado/a')} />
              <SelectItem value="cohabiting" text={t('cohabiting', 'Conviviente')} />
              <SelectItem value="other" text={t('other', 'Otro')} />
            </Select>
            <TextInput id="occupation" labelText={t('occupation', 'Ocupación')} value={draft.occupation} onChange={(event) => update('occupation', event.target.value)} />
            <TextInput id="email" type="email" labelText={t('email', 'Correo electrónico')} value={draft.email} onChange={(event) => update('email', event.target.value)} />
            <TextInput id="workplace" labelText={t('workplace', 'Lugar de trabajo')} value={draft.workplace} onChange={(event) => update('workplace', event.target.value)} />
            <TextInput id="permanence" labelText={t('permanence', 'Permanencia y fecha')} value={draft.permanence} onChange={(event) => update('permanence', event.target.value)} />
          </div>
        )}

        {step === 2 && (
          <div className={styles.formGrid}>
            <TextInput id="weight" labelText={t('weightKg', 'Peso (kg)')} value={draft.weight} onChange={(event) => update('weight', event.target.value)} />
            <TextInput id="height" labelText={t('heightCm', 'Talla (cm)')} value={draft.height} onChange={(event) => update('height', event.target.value)} />
            <TextInput
              id="blood-pressure"
              labelText={t('bloodPressure', 'Presión arterial (mmHg)')}
              placeholder="120/80"
              value={draft.bloodPressure}
              onChange={(event) => update('bloodPressure', event.target.value)}
            />
            <TextInput id="pulse" labelText={t('pulse', 'Frecuencia cardiaca (lpm)')} value={draft.pulse} onChange={(event) => update('pulse', event.target.value)} />
            <TextArea
              id="appearance"
              labelText={t('generalAppearance', 'Apariencia general')}
              value={draft.generalAppearance}
              onChange={(event) => update('generalAppearance', event.target.value)}
            />
            <TextArea
              id="venous-access"
              labelText={t('venousAccess', 'Inspección de brazos y accesos venosos')}
              value={draft.venousAccess}
              onChange={(event) => update('venousAccess', event.target.value)}
            />
          </div>
        )}

        {step === 3 && (
          <div className={styles.questionList}>
            <InlineNotification
              hideCloseButton
              kind="info"
              lowContrast
              title={t('confidentialInterview', 'Entrevista confidencial')}
              subtitle={t('interviewHelp', 'Las respuestas se registran por pregunta y versión; no determinan aptitud automáticamente.')}
            />
            {questionGroups.map((group) => (
              <section className={styles.questionGroup} key={group.key}>
                <h3>{t(group.key, group.fallback)}</h3>
                {group.questions.map(([key, fallback]) => (
                  <div className={styles.questionRow} key={key}>
                    <Select
                      id={`question-${key}`}
                      labelText={String(t(`question_${key}`, fallback))}
                      value={draft.answers[key] ?? ''}
                      onChange={(event) => updateAnswer(key, event.target.value)}>
                      <SelectItem value="" text={t('notAnswered', 'Sin responder')} />
                      <SelectItem value="yes" text={t('yes', 'Sí')} />
                      <SelectItem value="no" text={t('no', 'No')} />
                    </Select>
                    <TextInput
                      id={`question-note-${key}`}
                      labelText={t('answerObservation', 'Observación de la respuesta')}
                      value={draft.answerNotes[key] ?? ''}
                      onChange={(event) => updateAnswerNote(key, event.target.value)}
                    />
                  </div>
                ))}
              </section>
            ))}
            <section className={styles.questionGroup}>
              <h3>{t('femaleApplicantSection', 'Si la postulante es mujer')}</h3>
              <div className={styles.questionRow}>
                <TextInput id="last-menstruation" type="date" labelText={t('lastMenstruation', 'Fecha de última menstruación')} value={draft.lastMenstruation} onChange={(event) => update('lastMenstruation', event.target.value)} />
                <Select id="pregnant" labelText={t('currentlyPregnant', '¿Está gestando actualmente?')} value={draft.pregnant} onChange={(event) => update('pregnant', event.target.value)}>
                  <SelectItem value="" text={t('notAnswered', 'Sin responder')} /><SelectItem value="yes" text={t('yes', 'Sí')} /><SelectItem value="no" text={t('no', 'No')} />
                </Select>
                <Select id="breastfeeding" labelText={t('currentlyBreastfeeding', '¿Está dando de lactar?')} value={draft.breastfeeding} onChange={(event) => update('breastfeeding', event.target.value)}>
                  <SelectItem value="" text={t('notAnswered', 'Sin responder')} /><SelectItem value="yes" text={t('yes', 'Sí')} /><SelectItem value="no" text={t('no', 'No')} />
                </Select>
                <TextInput id="last-birth" type="date" labelText={t('lastBirth', 'Fecha del último parto')} value={draft.lastBirth} onChange={(event) => update('lastBirth', event.target.value)} />
                <TextInput id="pregnancy-count" labelText={t('pregnancyCount', 'Número de gestaciones')} value={draft.pregnancyCount} onChange={(event) => update('pregnancyCount', event.target.value)} />
              </div>
            </section>
          </div>
        )}

        {step === 4 && (
          <div className={styles.formGrid}>
            <Select
              id="decision"
              labelText={t('prequalification', 'Pre-calificación')}
              value={draft.decision}
              onChange={(event) => update('decision', event.target.value as SelectionDecision)}>
              <SelectItem value="pending" text={t('pendingReview', 'Pendiente de revisión')} />
              <SelectItem value="eligible" text={t('eligible', 'Apto')} />
              <SelectItem value="temporary" text={t('temporarilyIneligible', 'No apto temporal')} />
              <SelectItem value="permanent" text={t('permanentlyIneligible', 'No apto permanente')} />
            </Select>
            <TextInput
              id="reason"
              labelText={t('decisionReason', 'Motivo o criterio aplicado')}
              value={draft.reason}
              onChange={(event) => update('reason', event.target.value)}
            />
            {draft.decision === 'temporary' && (
              <TextInput
                id="return-date"
                type="date"
                labelText={t('returnDate', 'Fecha en que puede retornar')}
                value={draft.returnDate}
                onChange={(event) => update('returnDate', event.target.value)}
              />
            )}
            <TextInput
              id="interviewer"
              labelText={t('interviewer', 'Entrevistador responsable')}
              value={draft.interviewer}
              onChange={(event) => update('interviewer', event.target.value)}
            />
            <TextInput
              id="validator"
              labelText={t('validator', 'Profesional validador')}
              value={draft.validator}
              onChange={(event) => update('validator', event.target.value)}
            />
          </div>
        )}

        {step === 5 && (
          <div className={styles.reviewGrid}>
            <Tile>
              <span>{t('applicant', 'Postulante')}</span>
              <strong>{draft.familyName || draft.givenName ? `${draft.familyName}, ${draft.givenName}` : t('notRecorded', 'No registrado')}</strong>
              <small>{draft.documentNumber || t('documentPending', 'Documento pendiente')}</small>
            </Tile>
            <Tile>
              <span>{t('procedure', 'Procedimiento')}</span>
              <strong>{draft.procedureType === 'apheresis' ? t('apheresis', 'Aféresis') : t('wholeBlood', 'Sangre total')}</strong>
              <small>{t('answersCompleted', '{{count}} de {{total}} respuestas', { count: Object.keys(draft.answers).length, total: totalQuestions })}</small>
            </Tile>
            <Tile>
              <span>{t('prequalification', 'Pre-calificación')}</span>
              <strong>{t(`decision_${draft.decision}`, draft.decision)}</strong>
              <small>{draft.reason || t('withoutReason', 'Sin motivo registrado')}</small>
            </Tile>
            <Checkbox
              className={styles.fullWidth}
              id="professional-confirmation"
              checked={confirmed}
              labelText={t(
                'professionalConfirmation',
                'Confirmo que esta revisión requiere validación profesional y no ejecuta una decisión clínica real.',
              )}
              onChange={(_event, data) => setConfirmed(Boolean(data.checked))}
            />
            {saved && (
              <InlineNotification
                className={styles.fullWidth}
                hideCloseButton
                kind="success"
                lowContrast
                title={t('draftSaved', 'Borrador guardado')}
                subtitle={t('noClinicalPersistence', 'No se enviaron datos a OpenMRS ni a otro backend.')}
              />
            )}
          </div>
        )}

        <div className={styles.formActions}>
          <Button kind="secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
            {t('previous', 'Anterior')}
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>{t('next', 'Siguiente')}</Button>
          ) : (
            <Button disabled={!confirmed} onClick={() => setSaved(true)}>{t('saveSyntheticDraft', 'Guardar borrador')}</Button>
          )}
        </div>
      </section>
    </div>
  );
}
