const mockUsername = 'usuario123';
const mockPassword = 'usuario123';
const mockCookieName = 'sihsalus_dev_mock_session';

const authenticatedSession = {
  authenticated: true,
  locale: 'es',
  allowedLocales: ['es', 'en'],
  sessionId: 'sihsalus-local-mock-session',
  currentProvider: {
    uuid: '00000000-0000-4000-8000-000000000123',
    identifier: 'DEMO-123',
  },
  sessionLocation: {
    uuid: '00000000-0000-4000-8000-000000000456',
    display: 'Banco de Sangre · Sede demostración',
    links: [],
  },
  user: {
    uuid: '00000000-0000-4000-8000-000000000789',
    display: 'Usuario de demostración',
    username: mockUsername,
    systemId: mockUsername,
    userProperties: {},
    person: {
      uuid: '00000000-0000-4000-8000-000000000987',
      display: 'Usuario de demostración',
    },
    privileges: [],
    roles: [
      {
        uuid: '00000000-0000-4000-8000-000000000654',
        name: 'System Developer',
        display: 'System Developer',
        links: [],
      },
    ],
    retired: false,
    locale: 'es',
    allowedLocales: ['es', 'en'],
  },
};

function hasMockCookie(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((value) => value.trim())
    .includes(`${mockCookieName}=active`);
}

function hasValidBasicCredentials(authorization = '') {
  if (!authorization.startsWith('Basic ')) return false;

  try {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    return decoded === `${mockUsername}:${mockPassword}`;
  } catch {
    return false;
  }
}

function resolveDevMockSession({ authorization = '', cookie = '', method = 'GET' }) {
  if (method === 'DELETE') {
    return {
      body: { authenticated: false, sessionId: '' },
      setCookie: `${mockCookieName}=; Path=/openmrs; HttpOnly; SameSite=Lax; Max-Age=0`,
    };
  }

  if (authorization) {
    if (!hasValidBasicCredentials(authorization)) {
      return { body: { authenticated: false, sessionId: '' } };
    }

    return {
      body: authenticatedSession,
      setCookie: `${mockCookieName}=active; Path=/openmrs; HttpOnly; SameSite=Lax`,
    };
  }

  return {
    body: hasMockCookie(cookie) ? authenticatedSession : { authenticated: false, sessionId: '' },
  };
}

module.exports = { hasValidBasicCredentials, resolveDevMockSession };
