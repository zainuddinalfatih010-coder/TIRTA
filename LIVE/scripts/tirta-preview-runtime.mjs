import { preview } from "vite";

const server = await preview({
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    allowedHosts: [".trycloudflare.com"],
  },
});

const close = async () => {
  await server.close();
  process.exit(0);
};

process.once("SIGINT", close);
process.once("SIGTERM", close);
