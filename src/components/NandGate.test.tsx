import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import NandGate from './NandGate';

describe('NandGate', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts with both inputs at 0 and output at 1', () => {
    render(<NandGate />);
    expect(screen.getByText('NAND(0, 0) = 1')).toBeInTheDocument();
  });

  it('NAND(0, 1) = 1', () => {
    render(<NandGate />);
    fireEvent.click(screen.getByLabelText(/Input B/i));
    expect(screen.getByText('NAND(0, 1) = 1')).toBeInTheDocument();
  });

  it('NAND(1, 0) = 1', () => {
    render(<NandGate />);
    fireEvent.click(screen.getByLabelText(/Input A/i));
    expect(screen.getByText('NAND(1, 0) = 1')).toBeInTheDocument();
  });

  it('NAND(1, 1) = 0', () => {
    render(<NandGate />);
    fireEvent.click(screen.getByLabelText(/Input A/i));
    fireEvent.click(screen.getByLabelText(/Input B/i));
    expect(screen.getByText('NAND(1, 1) = 0')).toBeInTheDocument();
  });

  it('persists input state to localStorage', () => {
    const { unmount } = render(<NandGate />);
    fireEvent.click(screen.getByLabelText(/Input A/i));
    unmount();

    render(<NandGate />);
    expect(screen.getByText('NAND(1, 0) = 1')).toBeInTheDocument();
  });
});
