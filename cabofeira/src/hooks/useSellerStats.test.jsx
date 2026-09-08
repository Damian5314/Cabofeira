import { renderHook, waitFor } from '@testing-library/react';
import useSellerStats from './useSellerStats';
const mockRange = jest.fn();
jest.mock('../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range: mockRange }) }) }) }) } }));
beforeEach(() => mockRange.mockReset());
test('counts active ads separately and sums views beyond the first page', async () => {
  mockRange.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ status: 'active', views: 2 })) })
    .mockResolvedValueOnce({ data: [{ status: 'sold', views: 9 }] });
  const { result } = renderHook(() => useSellerStats('fixture'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toMatchObject({ total: 1001, active: 1000, views: 2009, error: false });
  expect(mockRange).toHaveBeenLastCalledWith(1000, 1999);
});
test('does not present a partial aggregate as a complete result after a failed page', async () => {
  mockRange.mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ status: 'active', views: 2 })) })
    .mockResolvedValueOnce({ error: new Error('offline') });
  const { result } = renderHook(() => useSellerStats('fixture'));
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.views).toBe(0);
});
