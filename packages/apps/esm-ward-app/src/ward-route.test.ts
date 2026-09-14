import { getWardLocationUuidFromPathname, getWardViewBasename } from './ward-route';

const originalGetSpaBase = window.getOpenmrsSpaBase;
const originalSpaBase = window.spaBase;

afterEach(() => {
  window.getOpenmrsSpaBase = originalGetSpaBase;
  window.spaBase = originalSpaBase;
});

it('shares the canonical SPA basename with Root, removing trailing slashes', () => {
  window.getOpenmrsSpaBase = () => '/custom/clinical///';
  expect(getWardViewBasename()).toBe('/custom/clinical/home/ward');
  expect(getWardLocationUuidFromPathname('/custom/clinical/home/ward/ward-one/')).toBe('ward-one');
  expect(getWardLocationUuidFromPathname('/openmrs/spa/home/ward/ward-one')).toBeUndefined();
});

it('preserves the configured SPA base fallback', () => {
  window.getOpenmrsSpaBase = undefined as unknown as typeof window.getOpenmrsSpaBase;
  window.spaBase = '/configured/spa/';
  expect(getWardViewBasename()).toBe('/configured/spa/home/ward');
});

it.each([
  ['ward-one', 'ward-one'],
  ['ward-one/', 'ward-one'],
  ['ward%2Done', 'ward-one'],
  ['ward%252Fone', 'ward%2Fone'],
  ['', undefined],
  ['/', undefined],
  ['ward-one//', undefined],
  ['ward-one/child', undefined],
  ['ward%2Fone', undefined],
  ['ward%5Cone', undefined],
  ['ward%3Fquery', undefined],
  ['ward%23hash', undefined],
  ['%20', undefined],
  ['%00', undefined],
  ['%7F', undefined],
  ['.', undefined],
  ['..', undefined],
  ['%E0%A4%A', undefined],
  ['ward-one?query', undefined],
])('parses only an exact safe route segment: %s', (segment, expected) => {
  window.getOpenmrsSpaBase = () => '/openmrs/spa/';
  expect(getWardLocationUuidFromPathname(`/openmrs/spa/home/ward/${segment}`)).toBe(expected);
});
