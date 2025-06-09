## hono-emitter

> `hono-emitter` is an Event emitter-based route handler for HonoJS.

### Installation

```bash
pnpm add -D @lazuee/hono-emitter
```

### Usage

```ts
import { argv } from "node:process";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import { HonoEmitter } from "@lazuee/hono-emitter";
import { Hono } from "hono";

const isCLI = fileURLToPath(import.meta.url) === argv[1];
const app = new Hono().basePath("/api").get("/ping", (ctx) => ctx.text("pong"));

export const emitter = new HonoEmitter(app, "http://localhost:3000")
  .on("get:/world", (ctx) => {
    console.log("hello world");
    return ctx.text("hello world");
  })
  .once("get:/world", async (_ctx, next) => {
    console.log("middleware start");
    await next();
    console.log("middleware end");
  });

emitter.on("get:/hello", (ctx) => ctx.text("hello")); // not included in typings (not chained)

if (isCLI) {
  // If running directly, start the server
  serve({ ...app, port: 3000 }, () => {
    console.log("server is running...");
  });
}
```

#### Client types
```ts
import { hc } from "hono/client";
import { emitter } from ".";

const log =
  <S extends string>(name: S) =>
  <T extends Record<string, any>>(x: T) =>
    x.text().then((y: string) => console.log(`${name}:`, y));

const client = hc<typeof emitter.app>("http://localhost:3000");
await client.api.ping.$get().then(log("client[/api/ping]"));
await client.api.world.$get().then(log("client[/api/world]"));
//@ts-expect-error - not available in types (not chained)
await client.api.hello.$get().then(log("client[/api/hello]"));

await emitter.emit("get:/api/ping").then(log("emitter[/api/ping]"));
await emitter.emit("get:/api/world").then(log("emitter[/api/world]"));
//@ts-expect-error - not available in types (not chained)
await emitter.emit("get:/api/hello").then(log("emitter[/api/hello]"));
```

For a usage example, check the [app/](https://github.com/lazuee/hono-emitter/tree/main/app) directory.

## License

This project is licensed under the MIT License - see the [LICENSE.md](https://github.com/lazuee/hono-emitter/blob/main/LICENSE.md) file for details

Copyright © `2025` `lazuee`