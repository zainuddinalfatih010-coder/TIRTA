import process from "node:process";
import { build, preview } from "vite";

await build();
const server = await preview({
  configFile: "vite.config.ts",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});

const close = async () => {
  try {
    await server.close();
  } catch (error) {
    void error;
  }
  process.exit(0);
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
