import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import App from './App';
import { queryClient } from './queryClient';

function renderApp() {
  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe('App', () => {
  it('renders navigation links', () => {
    renderApp();
    expect(screen.getByRole('link', { name: /menu/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /notes/i })).toBeInTheDocument();
  });
});
