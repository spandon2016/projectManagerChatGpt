import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import App from './App.jsx';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => ({})
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('renders the authentication screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /project manager/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
});
