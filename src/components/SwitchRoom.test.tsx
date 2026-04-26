import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SwitchRoom from './SwitchRoom';

describe('SwitchRoom', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('the room scene', () => {
    it('renders with both switches off and light on by default', () => {
      render(<SwitchRoom />);
      expect(screen.getByRole('switch', { name: /Switch A/i })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(screen.getByRole('switch', { name: /Switch B/i })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(screen.getByRole('status')).toHaveTextContent(/Light is on/i);
    });

    it('toggling switch A only leaves the light on', () => {
      render(<SwitchRoom />);
      fireEvent.click(screen.getByRole('switch', { name: /Switch A/i }));
      expect(screen.getByRole('status')).toHaveTextContent(/Light is on/i);
    });

    it('toggling switch B only leaves the light on', () => {
      render(<SwitchRoom />);
      fireEvent.click(screen.getByRole('switch', { name: /Switch B/i }));
      expect(screen.getByRole('status')).toHaveTextContent(/Light is on/i);
    });

    it('toggling both switches on turns the light off', () => {
      render(<SwitchRoom />);
      fireEvent.click(screen.getByRole('switch', { name: /Switch A/i }));
      fireEvent.click(screen.getByRole('switch', { name: /Switch B/i }));
      expect(screen.getByRole('status')).toHaveTextContent(/Light is off/i);
    });

    it('toggling one switch off after both on brings the light back on', () => {
      render(<SwitchRoom />);
      const a = screen.getByRole('switch', { name: /Switch A/i });
      const b = screen.getByRole('switch', { name: /Switch B/i });
      fireEvent.click(a);
      fireEvent.click(b);
      expect(screen.getByRole('status')).toHaveTextContent(/Light is off/i);
      fireEvent.click(a);
      expect(screen.getByRole('status')).toHaveTextContent(/Light is on/i);
    });
  });

  describe('the truth table', () => {
    it('starts with all four answer cells empty', () => {
      render(<SwitchRoom />);
      const cells = screen.getAllByRole('button', { name: /Light value/i });
      expect(cells).toHaveLength(4);
      cells.forEach((cell) => expect(cell).toHaveTextContent('—'));
    });

    it('clicking a cell cycles empty → off → on → off', () => {
      render(<SwitchRoom />);
      const cell = screen.getAllByRole('button', { name: /Light value/i })[0];
      expect(cell).toHaveTextContent('—');
      fireEvent.click(cell);
      expect(cell).toHaveTextContent('off');
      fireEvent.click(cell);
      expect(cell).toHaveTextContent('on');
      fireEvent.click(cell);
      expect(cell).toHaveTextContent('off');
    });
  });

  describe('verification', () => {
    it('shows the success block when all four cells match the NAND truth table', () => {
      render(<SwitchRoom />);
      const cells = screen.getAllByRole('button', { name: /Light value/i });
      // Rows 0-2 expected 'on' → 2 clicks each (null → off → on)
      [0, 1, 2].forEach((i) => {
        fireEvent.click(cells[i]);
        fireEvent.click(cells[i]);
      });
      // Row 3 expected 'off' → 1 click
      fireEvent.click(cells[3]);

      expect(screen.getByText(/that's it/i)).toBeInTheDocument();
      expect(screen.queryByText(/not quite/i)).not.toBeInTheDocument();
    });

    it('shows the "not quite" message when filled but incorrect', () => {
      render(<SwitchRoom />);
      const cells = screen.getAllByRole('button', { name: /Light value/i });
      // One click each → all 'off'. Rows 0-2 expected 'on', so this is wrong.
      cells.forEach((cell) => fireEvent.click(cell));

      expect(screen.getByText(/not quite/i)).toBeInTheDocument();
      expect(screen.queryByText(/that's it/i)).not.toBeInTheDocument();
    });

    it('shows nothing while any cell is still empty', () => {
      render(<SwitchRoom />);
      const cells = screen.getAllByRole('button', { name: /Light value/i });
      // Fill three of four
      fireEvent.click(cells[0]);
      fireEvent.click(cells[1]);
      fireEvent.click(cells[2]);

      expect(screen.queryByText(/that's it/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/not quite/i)).not.toBeInTheDocument();
    });
  });

  describe('persistence', () => {
    it('restores room state and answers from localStorage across mounts', () => {
      const { unmount } = render(<SwitchRoom />);
      fireEvent.click(screen.getByRole('switch', { name: /Switch A/i }));
      fireEvent.click(screen.getAllByRole('button', { name: /Light value/i })[0]);
      unmount();

      render(<SwitchRoom />);
      expect(screen.getByRole('switch', { name: /Switch A/i })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getAllByRole('button', { name: /Light value/i })[0]).toHaveTextContent(
        'off',
      );
    });
  });
});
