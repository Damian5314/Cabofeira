import { safeRedirect, whatsappNumber } from './links';

test.each(['https://evil.example', '//evil.example', '/\\evil.example', '/\nevil', null])('rejects external or ambiguous redirect %p', (value) => {
  expect(safeRedirect(value)).toBe('/');
});
test('preserves internal route, query and anchor', () => {
  expect(safeRedirect('/messages?conversation=123#latest')).toBe('/messages?conversation=123#latest');
});
test('normalizes local and international WhatsApp numbers', () => {
  expect(whatsappNumber('991 23 45')).toBe('2389912345');
  expect(whatsappNumber('00238 9912345')).toBe('2389912345');
  expect(whatsappNumber('123')).toBe('');
});
