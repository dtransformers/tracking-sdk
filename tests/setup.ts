// Mock global fetch
globalThis.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  } as Response)
);

// Mock Crypto for hashing
const mockSubtle = {
  digest: jest.fn((algorithm, data) => {
    // Return a dummy ArrayBuffer for sha-256
    return Promise.resolve(new ArrayBuffer(32));
  }),
  importKey: jest.fn(() => Promise.resolve({} as CryptoKey)),
  sign: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
};

Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: mockSubtle,
  },
});

// Mock TextEncoder / TextDecoder if not present in jsdom
if (globalThis.TextEncoder === undefined) {
  const { TextEncoder, TextDecoder } = require('node:util');
  (globalThis as any).TextEncoder = TextEncoder;
  (globalThis as any).TextDecoder = TextDecoder;
}

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  // Clear local and session storage
  localStorage.clear();
  sessionStorage.clear();
  // Clear cookies
  document.cookie = '';
});
