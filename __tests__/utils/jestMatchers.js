import { errorMessageMatches } from './testHelpers.js';

// Extend Jest matchers
expect.extend({
  toThrowWithMessage(received, expected) {
    try {
      received();
      return {
        pass: false,
        message: () => `Expected function to throw with message: ${expected}`
      };
    } catch (error) {
      const pass = errorMessageMatches(error, expected);
      if (pass) {
        return {
          pass: true,
          message: () => `Expected function not to throw with message: ${expected}`
        };
      } else {
        return {
          pass: false,
          message: () => `Expected error message to match "${expected}" but got "${error.message}"`
        };
      }
    }
  }
});

// Helper function to augment the expect.rejects.toThrow
global.expectToReject = async (promise, expectedMessage) => {
  try {
    await promise;
    throw new Error(`Expected promise to reject with message: ${expectedMessage}`);
  } catch (error) {
    expect(errorMessageMatches(error, expectedMessage)).toBe(true);
  }
};
