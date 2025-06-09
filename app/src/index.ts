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
  })
  .on("get:/user/:id", (ctx) => {
    const id = ctx.req.param("id");
    console.log(`user -> ${id}`);
    return ctx.text(`welcome ${id}`);
  });

emitter.on("get:/hello", (ctx) => ctx.text("hello"));

if (isCLI) {
  // If running directly, start the server
  serve({ ...app, port: 3000 }, () => {
    console.log("server is running...");
  });
}
