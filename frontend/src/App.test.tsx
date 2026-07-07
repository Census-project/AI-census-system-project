import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { resolveDashboardContent } from './pages/Index';

const queryClient = new QueryClient();

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
    expect(document.body).toBeInTheDocument();
  });

  it('shows the census form for enumerators on the collect tab', () => {
    const view = resolveDashboardContent({ role: 'enumerator', activeTab: 'collect', isOnline: true });
    render(<>{view}</>);
    expect(screen.getByText('Household Census Data Collection')).toBeInTheDocument();
  });
});