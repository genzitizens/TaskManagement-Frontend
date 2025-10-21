import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import App from './App';
import { queryClient } from './queryClient';

function renderApp() {
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe('App', () => {
  it('renders navigation links', () => {
    const { getByRole, queryByRole } = renderApp();
    expect(getByRole('link', { name: /menu/i })).toBeInTheDocument();
    expect(queryByRole('link', { name: /tasks/i })).not.toBeInTheDocument();
  });
});
