import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, useI18n } from './I18nContext';
import en from './en.json';
import pt from './pt-cv.json';

function Probe() {
  const { locale, setLocale } = useI18n();
  return <button onClick={() => setLocale('en')}>{locale}</button>;
}
beforeEach(() => localStorage.clear());
test('Portuguese is the default and an explicit English choice persists', () => {
  const { unmount } = render(<I18nProvider><Probe /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'pt-cv' }));
  expect(localStorage.getItem('cabofeira_locale')).toBe('en');
  unmount();
  render(<I18nProvider><Probe /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'en' })).toBeTruthy();
});
test('invalid stored language falls back to Portuguese', () => {
  localStorage.setItem('cabofeira_locale', 'invalid');
  render(<I18nProvider><Probe /></I18nProvider>);
  expect(screen.getByRole('button', { name: 'pt-cv' })).toBeTruthy();
});
test('Portuguese and English have matching translation keys', () => {
  const keys = (obj, prefix = '') => Object.entries(obj).flatMap(([key, value]) => typeof value === 'object' ? keys(value, prefix + key + '.') : prefix + key).sort();
  expect(keys(pt)).toEqual(keys(en));
});
