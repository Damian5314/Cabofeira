import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPassword from './ForgotPassword';
import { I18nProvider } from '../i18n/I18nContext';
const mockReset = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ requestPasswordReset: mockReset }) }));
// CRA's Jest 27 resolver does not understand React Router 7's exports map.
jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
test('a rejected password reset request announces an error and permits retry', async () => {
  mockReset.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true });
  render(<I18nProvider><ForgotPassword /></I18nProvider>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'fixture@example.test' } });
  fireEvent.click(screen.getByRole('button'));
  await screen.findByRole('alert');
  expect(screen.getByRole('button').disabled).toBe(false);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
  expect(mockReset).toHaveBeenCalledTimes(2);
});
