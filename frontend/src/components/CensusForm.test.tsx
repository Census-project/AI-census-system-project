import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CensusForm from './CensusForm';

describe('CensusForm', () => {
  it('renders NIN and BVN fields for each household member', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <CensusForm isOnline={true} />
      </QueryClientProvider>
    );

    expect(screen.getByText('NIN')).toBeInTheDocument();
    expect(screen.getByText('BVN')).toBeInTheDocument();
  });
});
