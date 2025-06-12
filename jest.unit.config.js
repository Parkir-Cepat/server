export default {
  preset: "jest",
  testEnvironment: "node",
  moduleFileExtensions: ["js", "json"],
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  testMatch: ["**/__tests__/unit/**/*.test.js"],
  collectCoverageFrom: [
    "models/**/*.js",
    "helpers/**/*.js",
    "!**/__tests__/**",
    "!**/node_modules/**",
  ],
  setupFilesAfterEnv: ["<rootDir>/__tests__/unit.setup.js"],
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
};
