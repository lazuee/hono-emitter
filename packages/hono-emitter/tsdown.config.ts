import { defineConfig, type Options } from "tsdown";

export const baseConfig: Options = {
  clean: true,
  dts: true,
  fixedExtension: false,
  inputOptions: { resolve: { tsconfigFilename: "tsconfig.json" } },
  platform: "node",
  removeNodeProtocol: true,
  unbundle: true,
  unused: false,
};

const config: ReturnType<typeof defineConfig> = defineConfig([
  {
    ...baseConfig,
    entry: ["./src/index.ts"],
    format: ["cjs", "esm"],
  },
  {
    ...baseConfig,
    dts: { emitDtsOnly: true },
    entry: ["./src/types.ts"],
  },
]);

export default config;
