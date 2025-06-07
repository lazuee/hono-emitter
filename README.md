## hono-emitter

> `hono-emitter` is an Event emitter-based route handler for HonoJS.

### Installation

```bash
pnpm add -D @lazuee/hono-emitter
```

### Usage

```ts
import { serve } from "@hono/node-server";
import { HonoEmitter } from "@lazuee/hono-emitter";
import { Hono } from "hono";

const app = new Hono().basePath("/api").get("/ping", (ctx) => ctx.text("pong"));

export const network = new HonoEmitter(app)
  .on("get:/world", (ctx) => {
    console.log("hello world");
    return ctx.text("hello world");
  })
  .once("get:/world", async (_ctx, next) => {
    console.log("middleware start");
    await next();
    console.log("middleware end");
  });

network.on("get:/hello", (ctx) => ctx.text("hello")); // not included in typings (not chained)

serve({ ...app, port: 3000 }, () => console.log("server is running..."));
```

#### Client types
```ts
import { hc } from "hono/client";
import { type emitter } from ".";

const client = hc<typeof emitter.app>("/");
client.api.ping.$get();
client.api.world.$get();
// client.api.hello.$get(); // not available in types (not chained)
```

For a usage example, check the [app/](https://github.com/lazuee/hono-emitter/tree/main/app) directory.

## License

This project is licensed under the MIT License - see the [LICENSE.md](https://github.com/lazuee/hono-emitter/blob/main/LICENSE.md) file for details

Copyright © `2025` `lazuee`