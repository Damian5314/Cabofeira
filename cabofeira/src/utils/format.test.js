import { formatPrice, timeAgo } from './format';
test('zero price and relative dates follow the selected language', () => {
  expect(formatPrice(0)).toBe('Preço sob consulta');
  expect(formatPrice(0, 'CVE', 'en')).toBe('Contact for price');
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 8, 8));
  expect(timeAgo('2026-09-06T00:00:00Z', 'pt-cv')).toMatch(/2 dias/);
  expect(timeAgo('2026-09-06T00:00:00Z', 'en')).toBe('2 days ago');
  now.mockRestore();
});
test('invalid dates and prices never render NaN or Infinity', () => {
  expect(timeAgo('invalid')).toBe('');
  expect(formatPrice(Infinity)).toBe('—');
});
