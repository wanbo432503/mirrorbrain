// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import KeptCandidateCard from './KeptCandidateCard';
import type { ReviewedMemory } from '../../types/index';

describe('KeptCandidateCard', () => {
  const mockReviewedMemory: ReviewedMemory = {
    id: 'reviewed:candidate:test-1',
    candidateMemoryId: 'candidate:test-1',
    candidateTitle: 'Test Candidate',
    candidateSummary: 'Test summary',
    candidateTheme: 'test',
    memoryEventIds: ['event-1', 'event-2'],
    reviewDate: '2026-04-28',
    decision: 'keep',
    reviewedAt: '2026-04-28T10:00:00Z',
  };

  afterEach(() => {
    cleanup();
  });

  it('should render candidate title', () => {
    render(<KeptCandidateCard reviewedMemory={mockReviewedMemory} onUndo={() => {}} />);

    expect(screen.getByText('Test Candidate')).not.toBeNull();
  });

  it('should render kept badge', () => {
    render(<KeptCandidateCard reviewedMemory={mockReviewedMemory} onUndo={() => {}} />);

    expect(screen.getByText('Kept')).not.toBeNull();
  });

  it('should call onUndo when undo button clicked', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();

    render(<KeptCandidateCard reviewedMemory={mockReviewedMemory} onUndo={onUndo} />);

    await user.click(screen.getByRole('button', { name: 'Undo keep' }));

    expect(onUndo).toHaveBeenCalledWith('reviewed:candidate:test-1');
  });
});
