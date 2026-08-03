type Translate = (key: string, defaultValue: string) => string;

export function indicatorsErrorMessageOptions(t: Translate) {
  return {
    logContext: 'Indicadores clínicos',
    statusMessages: {
      400: t('indicatorsError400', 'Los datos enviados no son válidos. Revise el formulario.'),
      401: t('indicatorsError401', 'Su sesión venció. Inicie sesión nuevamente.'),
      403: t('indicatorsError403', 'No tiene permiso para realizar esta operación.'),
      404: t('indicatorsError404', 'El registro solicitado ya no existe.'),
      409: t(
        'indicatorsError409',
        'El registro fue modificado por otra operación. Actualice e intente nuevamente.',
      ),
      422: t('indicatorsError422', 'Los datos enviados no cumplen las reglas del indicador.'),
      500: t('indicatorsError500', 'El servicio de indicadores encontró un error. Intente nuevamente.'),
      502: t('indicatorsError502', 'El servicio de indicadores no está disponible en este momento.'),
      503: t('indicatorsError503', 'El servicio de indicadores no está disponible en este momento.'),
      504: t('indicatorsError504', 'El servicio de indicadores tardó demasiado en responder.'),
    },
  } as const;
}
