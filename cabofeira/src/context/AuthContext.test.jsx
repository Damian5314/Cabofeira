import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { I18nProvider } from '../i18n/I18nContext';

let mockAuthCallback;
const mockSingle = jest.fn();
const mockSession = { user: { id: 'fixture-user' } };
jest.mock('../lib/supabase', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ single: mockSingle }) }) }),
  auth: {
    getSession: async () => ({ data: { session: mockSession } }),
    onAuthStateChange: (callback) => { mockAuthCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  },
} }));
function ProtectedProbe() { const { user } = useAuth(); return <div>{user ? 'Authenticated' : 'Redirect to login'}</div>; }

test('initial session and auth event share the same pending profile before showing protected content', async () => {
  jest.useFakeTimers();
  let resolveProfile;
  mockSingle.mockReturnValue(new Promise(resolve => { resolveProfile = resolve; }));
  render(<I18nProvider><AuthProvider><ProtectedProbe /></AuthProvider></I18nProvider>);
  await act(async () => { await Promise.resolve(); });
  await act(async () => { mockAuthCallback('INITIAL_SESSION', mockSession); jest.runOnlyPendingTimers(); });
  expect(mockSingle).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Redirect to login')).toBeNull();
  await act(async () => { resolveProfile({ data: { id: 'fixture-user', name: 'Fixture', role: 'user' }, error: null }); });
  expect(screen.getByText('Authenticated')).toBeTruthy();
  jest.useRealTimers();
});
