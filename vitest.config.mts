import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 날짜 계산(localDateString 등)이 실행 환경(KST/UTC CI)에 따라 달라지지 않도록 고정
process.env.TZ = "Asia/Seoul";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 20000,
  },
});
