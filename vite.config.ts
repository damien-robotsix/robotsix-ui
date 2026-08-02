import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    lib: {
      // Two entries: `index` pulls in the React wrapper, `vanilla` is
      // React-free so server-rendered UIs can load it with a plain
      // <script type="module"> and no bundler.
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        vanilla: resolve(__dirname, "src/vanilla.ts"),
      },
      name: "RobotsixUI",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format === "cjs" ? "cjs" : "js"}`,
      cssFileName: "style",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
      },
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      include: ["src"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test-setup.ts"],
      // Per-file declarations rather than a single rolled-up bundle: with two
      // library entries each needs its own .d.ts next to its .js.
      rollupTypes: false,
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
  },
});
