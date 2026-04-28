import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import RandomAccessMemory from './RandomAccessMemory';

describe('RandomAccessMemory', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts at address 0 with every cell empty', () => {
    render(<RandomAccessMemory />);
    expect(screen.getByLabelText('address as number')).toHaveTextContent('0');
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('0');

    const grid = screen.getByRole('grid', { name: /256-byte memory grid/i });
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(256);
  });

  it('toggling MAR bits selects the corresponding cell', () => {
    render(<RandomAccessMemory />);
    // Address = bit 0 + bit 5 = 1 + 32 = 33.
    fireEvent.click(screen.getByRole('switch', { name: /MAR bit 0/i }));
    fireEvent.click(screen.getByRole('switch', { name: /MAR bit 5/i }));
    expect(screen.getByLabelText('address as number')).toHaveTextContent('33');

    // Cell 33 is the selected one.
    const cell = screen.getByRole('gridcell', { name: /Address 33,.*selected/i });
    expect(cell).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking a cell sets the MAR to that cell index', () => {
    render(<RandomAccessMemory />);
    // Click cell at address 100.
    fireEvent.click(screen.getByRole('gridcell', { name: /^Address 100,/i }));
    expect(screen.getByLabelText('address as number')).toHaveTextContent('100');
  });

  it('Write captures the data switches into the selected cell', () => {
    render(<RandomAccessMemory />);
    // Select address 5 via MAR.
    fireEvent.click(screen.getByRole('switch', { name: /MAR bit 0/i })); // +1
    fireEvent.click(screen.getByRole('switch', { name: /MAR bit 2/i })); // +4 → 5
    expect(screen.getByLabelText('address as number')).toHaveTextContent('5');

    // Set data = 42 (bits 1, 3, 5).
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 1/i }));
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 3/i }));
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 5/i }));

    fireEvent.click(screen.getByRole('button', { name: /Write the data into address 5/i }));
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('42');
  });

  it('a written cell persists when the address changes and is restored on revisit', () => {
    render(<RandomAccessMemory />);

    // Write 7 to address 0.
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 0/i }));
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 1/i }));
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 2/i }));
    fireEvent.click(screen.getByRole('button', { name: /Write the data into address 0/i }));
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('7');

    // Move to address 200.
    fireEvent.click(screen.getByRole('gridcell', { name: /^Address 200,/i }));
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('0');

    // Move back to address 0 — the 7 is still there.
    fireEvent.click(screen.getByRole('gridcell', { name: /^Address 0,/i }));
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('7');
  });

  it('Clear cell zeros the selected address only', () => {
    render(<RandomAccessMemory />);
    // Write 99 to address 0 and 42 to address 1.
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 0/i })); // 1
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 1/i })); // 3
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 5/i })); // 35
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 6/i })); // 99
    fireEvent.click(screen.getByRole('button', { name: /Write the data into address 0/i }));

    fireEvent.click(screen.getByRole('gridcell', { name: /^Address 1,/i }));
    fireEvent.click(screen.getByRole('button', { name: /Write the data into address 1/i }));
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('99');

    // Now go back and clear address 0.
    fireEvent.click(screen.getByRole('gridcell', { name: /^Address 0,/i }));
    fireEvent.click(screen.getByRole('button', { name: /Clear address 0/i }));
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('0');

    // Address 1 still has 99.
    fireEvent.click(screen.getByRole('gridcell', { name: /^Address 1,/i }));
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('99');
  });

  it('persists cells, MAR, and data across mounts', () => {
    const { unmount } = render(<RandomAccessMemory />);
    fireEvent.click(screen.getByRole('gridcell', { name: /^Address 7,/i }));
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 0/i }));
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 4/i })); // 17
    fireEvent.click(screen.getByRole('button', { name: /Write the data into address 7/i }));
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('17');
    unmount();

    render(<RandomAccessMemory />);
    expect(screen.getByLabelText('address as number')).toHaveTextContent('7');
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('17');
  });

  it('Clear all zeros every cell but leaves MAR and data alone', () => {
    render(<RandomAccessMemory />);
    fireEvent.click(screen.getByRole('switch', { name: /Data bit 0/i }));
    fireEvent.click(screen.getByRole('button', { name: /Write the data into address 0/i }));
    fireEvent.click(screen.getByRole('gridcell', { name: /^Address 5,/i }));
    fireEvent.click(screen.getByRole('button', { name: /Write the data into address 5/i }));

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Clear all$/i }));
    });
    fireEvent.click(screen.getByRole('gridcell', { name: /^Address 0,/i }));
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('gridcell', { name: /^Address 5,/i }));
    expect(screen.getByLabelText('selected cell as number')).toHaveTextContent('0');
  });
});
