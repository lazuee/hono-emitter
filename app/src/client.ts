import { hc } from "hono/client";
import { emitter } from ".";

const log =
  <S extends string>(name: S) =>
  <T extends Record<string, any>>(x: T) =>
    x.text().then((y: string) => console.log(`${name}: ${y}`));

const client = hc<typeof emitter.app>("http://localhost:3000");
await client.api.ping.$get().then(log("client[/api/ping]"));
await client.api.world.$get().then(log("client[/api/world]"));
//@ts-expect-error - not available in types (not chained)
await client.api.hello.$get().then(log("client[/api/hello]"));
await client.api.user[":id"]
  .$get({ param: { id: "1" } })
  .then(log("client[/api/user/:id]"));

await emitter.emit("get:/api/ping").then(log("emitter[/api/ping]"));
await emitter.emit("get:/api/world").then(log("emitter[/api/world]"));
//@ts-expect-error - not available in types (not chained)
await emitter.emit("get:/api/hello").then(log("emitter[/api/hello]"));
await emitter
  .emit("get:/api/user/:id", { param: { id: "2" } })
  .then(log("emitter[/api/user/:id]"));
