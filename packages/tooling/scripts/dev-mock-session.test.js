const assert = require('node:assert/strict');
const test = require('node:test');

const { hasValidBasicCredentials, resolveDevMockSession } = require('./dev-mock-session');

const validAuthorization = `Basic ${Buffer.from('usuario123:usuario123').toString('base64')}`;

test('accepts only the documented synthetic credentials', () => {
  assert.equal(hasValidBasicCredentials(validAuthorization), true);
  assert.equal(hasValidBasicCredentials(`Basic ${Buffer.from('usuario123:incorrecta').toString('base64')}`), false);
  assert.equal(hasValidBasicCredentials('Bearer token'), false);
});

test('creates and restores a local mock session', () => {
  const login = resolveDevMockSession({ authorization: validAuthorization });
  assert.equal(login.body.authenticated, true);
  assert.equal(login.body.user.username, 'usuario123');
  assert.match(login.setCookie, /sihsalus_dev_mock_session=active/);

  const restored = resolveDevMockSession({ cookie: 'sihsalus_dev_mock_session=active' });
  assert.equal(restored.body.authenticated, true);
  assert.ok(restored.body.sessionLocation);
});

test('rejects invalid credentials and clears the session on logout', () => {
  const invalid = resolveDevMockSession({
    authorization: `Basic ${Buffer.from('usuario123:incorrecta').toString('base64')}`,
  });
  assert.equal(invalid.body.authenticated, false);

  const logout = resolveDevMockSession({ method: 'DELETE', cookie: 'sihsalus_dev_mock_session=active' });
  assert.equal(logout.body.authenticated, false);
  assert.match(logout.setCookie, /Max-Age=0/);
});
