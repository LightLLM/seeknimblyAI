import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  collectCoverageFrom: ["lib/**/*.ts", "!lib/**/*.test.ts", "!lib/**/*.d.ts"],
};

export default createJestConfig(config);
