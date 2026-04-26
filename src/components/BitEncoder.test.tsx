import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import BitEncoder from './BitEncoder';

describe('BitEncoder', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders with 3 bits, all at 0, showing the number 0', () => {
    render(<BitEncoder />);

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(3);
    switches.forEach((s) => expect(s).toHaveAttribute('aria-checked', 'false'));

    expect(screen.getByLabelText('bits as binary')).toHaveTextContent('0 0 0');
    expect(screen.getByLabelText('bits as number')).toHaveTextContent('0');
  });

  describe('bits → number conversion', () => {
    it('toggling Bit 1 (middle of three) shows binary "0 1 0" and decimal 2', () => {
      render(<BitEncoder />);
      fireEvent.click(screen.getByRole('switch', { name: /Bit 1/i }));
      expect(screen.getByLabelText('bits as binary')).toHaveTextContent(
        '0 1 0',
      );
      expect(screen.getByLabelText('bits as number')).toHaveTextContent('2');
    });

    it('toggling all three bits shows binary "1 1 1" and decimal 7', () => {
      render(<BitEncoder />);
      fireEvent.click(screen.getByRole('switch', { name: /Bit 0/i }));
      fireEvent.click(screen.getByRole('switch', { name: /Bit 1/i }));
      fireEvent.click(screen.getByRole('switch', { name: /Bit 2/i }));
      expect(screen.getByLabelText('bits as binary')).toHaveTextContent(
        '1 1 1',
      );
      expect(screen.getByLabelText('bits as number')).toHaveTextContent('7');
    });

    it('toggling only Bit 2 (the MSB of three) shows binary "1 0 0" and decimal 4', () => {
      render(<BitEncoder />);
      fireEvent.click(screen.getByRole('switch', { name: /Bit 2/i }));
      expect(screen.getByLabelText('bits as binary')).toHaveTextContent(
        '1 0 0',
      );
      expect(screen.getByLabelText('bits as number')).toHaveTextContent('4');
    });
  });

  it('Add a bit increases count up to 8 max, then disabled', () => {
    render(<BitEncoder />);
    const addBtn = screen.getByRole('button', { name: /Add a bit/i });

    expect(screen.getAllByRole('switch')).toHaveLength(3);

    // Click add 5 times → 8 toggles.
    for (let i = 0; i < 5; i++) fireEvent.click(addBtn);
    expect(screen.getAllByRole('switch')).toHaveLength(8);
    expect(addBtn).toBeDisabled();

    // Clicking again has no effect.
    fireEvent.click(addBtn);
    expect(screen.getAllByRole('switch')).toHaveLength(8);
  });

  it('Remove a bit decreases count down to 1 min, then disabled', () => {
    render(<BitEncoder />);
    const removeBtn = screen.getByRole('button', { name: /Remove a bit/i });

    expect(screen.getAllByRole('switch')).toHaveLength(3);

    fireEvent.click(removeBtn);
    fireEvent.click(removeBtn);
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(removeBtn).toBeDisabled();

    fireEvent.click(removeBtn);
    expect(screen.getAllByRole('switch')).toHaveLength(1);
  });

  it('the possibility grid contains 2^N cells for N bits', () => {
    render(<BitEncoder />);

    const grid = screen.getByLabelText(/possibility grid/i);
    expect(grid.children).toHaveLength(8); // 2^3

    fireEvent.click(screen.getByRole('button', { name: /Add a bit/i }));
    expect(grid.children).toHaveLength(16); // 2^4

    fireEvent.click(screen.getByRole('button', { name: /Remove a bit/i }));
    fireEvent.click(screen.getByRole('button', { name: /Remove a bit/i }));
    fireEvent.click(screen.getByRole('button', { name: /Remove a bit/i }));
    expect(grid.children).toHaveLength(2); // 2^1
  });
});
