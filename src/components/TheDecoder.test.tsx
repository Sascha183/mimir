import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TheDecoder from './TheDecoder';

describe('TheDecoder', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts with A=0, B=0 → output 0 active, all others off', () => {
    render(<TheDecoder />);
    expect(screen.getByLabelText('address as binary')).toHaveTextContent('00');
    expect(screen.getByLabelText('address as number')).toHaveTextContent('0');
    expect(screen.getByLabelText(/Output 0:/i)).toHaveAttribute('aria-label', 'Output 0: on');
    [1, 2, 3].forEach((i) => {
      expect(screen.getByLabelText(new RegExp(`Output ${i}:`, 'i'))).toHaveAttribute(
        'aria-label',
        `Output ${i}: off`,
      );
    });
  });

  it.each([
    [0, 0, 0],
    [0, 1, 1],
    [1, 0, 2],
    [1, 1, 3],
  ])('A=%d, B=%d → output %d is the only one on', (a, b, expected) => {
    render(<TheDecoder />);
    if (a === 1) fireEvent.click(screen.getByRole('switch', { name: /Input A/i }));
    if (b === 1) fireEvent.click(screen.getByRole('switch', { name: /Input B/i }));

    expect(screen.getByLabelText('address as number')).toHaveTextContent(String(expected));
    expect(screen.getByLabelText(`Output ${expected}: on`)).toBeInTheDocument();
    [0, 1, 2, 3]
      .filter((i) => i !== expected)
      .forEach((i) => {
        expect(screen.getByLabelText(`Output ${i}: off`)).toBeInTheDocument();
      });
  });

  it('persists the input state across mounts', () => {
    const { unmount } = render(<TheDecoder />);
    fireEvent.click(screen.getByRole('switch', { name: /Input A/i }));
    fireEvent.click(screen.getByRole('switch', { name: /Input B/i }));
    expect(screen.getByLabelText('address as number')).toHaveTextContent('3');
    unmount();

    render(<TheDecoder />);
    expect(screen.getByLabelText('address as number')).toHaveTextContent('3');
    expect(screen.getByLabelText('Output 3: on')).toBeInTheDocument();
  });
});
