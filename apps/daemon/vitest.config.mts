import { defineConfig } from "vitest/config";
import { createBaseConfig } from "@repo/config-vitest/base";

export default defineConfig(
  createBaseConfig({
    test: {
      environment: "node",
      include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
    },
  }),
);
