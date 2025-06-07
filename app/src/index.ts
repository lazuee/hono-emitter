import { serve } from "@hono/node-server";
import { HonoEmitter } from "@lazuee/hono-emitter";
import { Hono } from "hono";

const app = new Hono().basePath("/api").get("/ping", (ctx) => ctx.text("pong"));

export const emitter = new HonoEmitter(app)
  .on("get:/world", (ctx) => {
    console.log("hello world");
    return ctx.text("hello world");
  })
  .once("get:/world", async (_ctx, next) => {
    console.log("middleware start");
    await next();
    console.log("middleware end");
  });

emitter.on("get:/hello", (ctx) => ctx.text("hello"));

serve({ ...app, port: 3000 }, () => console.log("server is running..."));
