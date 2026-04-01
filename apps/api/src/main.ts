import "dotenv/config";
import { buildApp } from "./build-app.js";

const app = await buildApp();

const port = Number(process.env.PORT || 3333);
const host = process.env.HOST || "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    app.log.info(`API rodando em http://${host}:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
