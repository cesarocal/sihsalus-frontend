export const indicatorsErrorMessageOptions = {
  logContext: 'Indicadores clínicos',
  statusMessages: {
    400: 'Los datos enviados no son válidos. Revise el formulario.',
    401: 'Su sesión venció. Inicie sesión nuevamente.',
    403: 'No tiene permiso para realizar esta operación.',
    404: 'El registro solicitado ya no existe.',
    409: 'El registro fue modificado por otra operación. Actualice e intente nuevamente.',
    422: 'Los datos enviados no cumplen las reglas del indicador.',
    500: 'El servicio de indicadores encontró un error. Intente nuevamente.',
    502: 'El servicio de indicadores no está disponible en este momento.',
    503: 'El servicio de indicadores no está disponible en este momento.',
    504: 'El servicio de indicadores tardó demasiado en responder.',
  },
} as const;
