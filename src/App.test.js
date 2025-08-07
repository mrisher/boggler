import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      text: () => Promise.resolve(''),
    })
  );
});

// Mocking window.location.search
Object.defineProperty(window, 'location', {
  value: {
    search: '',
  },
  writable: true,
});

test('renders Nomoggle title', async () => {
  render(<App />);
  const linkElement = await screen.findByText(/Nomoggle/i);
  expect(linkElement).toBeInTheDocument();
});
