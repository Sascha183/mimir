import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TimelineSignal from './TimelineSignal';
import type { Bit } from '../../lib/gates/types';

describe('TimelineSignal', () => {
  it('renders one cell per bit', () => {
    const bits: Bit[] = [0, 1, 1, 0, 0, 1];
    render(<TimelineSignal label="x" bits={bits} activeIndex={0} />);
    expect(screen.getAllByRole('cell')).toHaveLength(6);
  });

  it('marks each cell on/off via data-on according to the bit value', () => {
    const bits: Bit[] = [0, 1, 0, 1];
    render(<TimelineSignal label="x" bits={bits} activeIndex={0} />);
    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveAttribute('data-on', 'false');
    expect(cells[1]).toHaveAttribute('data-on', 'true');
    expect(cells[2]).toHaveAttribute('data-on', 'false');
    expect(cells[3]).toHaveAttribute('data-on', 'true');
  });

  it('marks exactly one cell as active', () => {
    const bits: Bit[] = [0, 0, 0, 0, 0];
    render(<TimelineSignal label="x" bits={bits} activeIndex={2} />);
    const cells = screen.getAllByRole('cell');
    expect(cells.filter((c) => c.getAttribute('data-active') === 'true')).toHaveLength(1);
    expect(cells[2]).toHaveAttribute('data-active', 'true');
  });

  it('uses cellLabels when provided', () => {
    const bits: Bit[] = [1, 0];
    render(
      <TimelineSignal
        label="x"
        bits={bits}
        activeIndex={0}
        cellLabels={['A', 'B']}
      />,
    );
    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('A');
    expect(cells[1]).toHaveTextContent('B');
  });
});
