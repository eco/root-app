// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Learn more: https://github.com/testing-library/jest-dom
// import '@testing-library/jest-dom/extend-expect'

// Mock BigInt for JSON.stringify
// Without this, tests involving BigInt would fail when stringifying
BigInt.prototype.toJSON = function () {
  return this.toString();
};
