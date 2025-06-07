import { Hono, type Context, type Next } from "hono";
import { type HonoBase } from "hono/hono-base";
import { type BlankInput, type HandlerResponse, type Input } from "hono/types";
import {
  type HonoExtend,
  type HTTPMethod,
  type RouteEvent,
  type RouteHandler,
} from "./types";

const regexLeadingSlash = /^\//;
const DATE = Symbol("dateCreated");
const isPromise = <T>(value: unknown): value is Promise<T> =>
  value !== undefined &&
  value !== null &&
  typeof value === "object" &&
  "then" in value &&
  typeof (value as any).then === "function";

export class HonoEmitter<H extends HonoBase = Hono> {
  #raw: H;
  #routes = new Map<
    `${HTTPMethod}:${string}`,
    {
      method: HTTPMethod;
      path: string;
      handlers: [handler: RouteHandler<H, any>, once: boolean][];
    }
  >();

  [key: string]: unknown;

  constructor(hono: H = new Hono() as H) {
    this.#raw = hono;
    const honoFetch = this.#raw.fetch;
    this.#raw.fetch = (request, env, ctx) => {
      this.#register();
      return honoFetch.bind(this.#raw)(request, env, ctx);
    };
  }

  get app() {
    return this.#raw;
  }

  #dispatch(id: `${HTTPMethod}:${string}`, ctx: Context, next: Next) {
    const entry = this.#routes.get(id)!;
    const handlers = entry.handlers;
    let index = -1;

    const runChain = async (i = 0) => {
      if (i <= index) throw new Error("next() called multiple times");
      if (i >= handlers.length) return next();
      index = i;

      const [handler = null, once = false] = handlers[i];
      if (!handler) return next();
      if (once) this.off(id, handler);

      let called = false;
      let nextResult: Response | Promise<Response> | undefined;
      const localNext: Next = () => {
        if (called) {
          throw new Error(`next() called multiple times in handler[${i}]`);
        }
        called = true;
        nextResult = runChain(i + 1);
        return Promise.resolve();
      };

      const result = handler.call(this, ctx, localNext);
      if (result instanceof Response) return result;
      if (called) {
        if (nextResult instanceof Response) return nextResult;
        if (isPromise(nextResult)) return await nextResult;
      }
      if (isPromise(result)) return await result;

      return result;
    };

    return runChain();
  }

  on<
    K extends keyof RouteEvent,
    I extends Input = BlankInput,
    R extends HandlerResponse<any> = any,
  >(event: K, handler: RouteHandler<H, K, I, R>): HonoExtend<H, K, I, R>;
  on<
    K extends keyof RouteEvent,
    I extends Input = BlankInput,
    R extends HandlerResponse<any> = any,
  >(
    event: K,
    handler: RouteHandler<H, K, I, R>,
    once: boolean,
  ): HonoExtend<H, K, I, R>;
  on<
    K extends keyof RouteEvent,
    I extends Input = BlankInput,
    R extends HandlerResponse<any> = any,
  >(event: K, handler: RouteHandler<H, K, I, R>, once = false) {
    if (!(handler as any)[DATE]) {
      (handler as any)[DATE] = Date.now() + Math.random();
    }

    const [method, ...rest] = event.split(":");
    const path = rest.join(":").trim().replace(regexLeadingSlash, "");
    const m = method.toLowerCase() as HTTPMethod;
    const id = `${m}:${path}` as const;
    const route = this.#routes.get(id);

    if (route) {
      const handlers = route.handlers;
      if (this.__once || once) {
        let insertIndex = 0;
        for (const [i, arr] of handlers.entries()) {
          if (arr[1] === false) {
            insertIndex = i;
            break;
          }
        }

        handlers.splice(insertIndex, 0, [handler, once]);
      } else route.handlers.push([handler, once]);
    } else {
      const handlers: [handler: RouteHandler<H, any>, once: boolean][] = [];
      this.#routes.set(id, { handlers, method: m, path });
      handlers.push([handler, once]);

      if (handlers.length > 0 && this.__once) {
        this.#raw.on(method, path, (ctx, next) =>
          this.#dispatch(id, ctx, next),
        );
      }
    }

    return this as any;
  }

  once<
    K extends keyof RouteEvent,
    I extends Input = BlankInput,
    R extends HandlerResponse<any> = any,
  >(event: K, handler: RouteHandler<H, K, I, R>) {
    return this.on(event, handler, true);
  }

  off<K extends keyof RouteEvent>(event: K, handler: RouteHandler<H, K>) {
    const [method, ...rest] = event.split(":");
    const path = rest.join(":").trim().replace(regexLeadingSlash, "");
    const m = method.toLowerCase() as HTTPMethod;
    const id = `${m}:${path}` as const;

    const entry = this.#routes.get(id);
    if (!entry) return this;
    entry.handlers = entry.handlers.filter((fn) => {
      const sameFn = fn[0] === handler;
      const sameStamp = (fn[0] as any)[DATE] === (handler as any)[DATE];
      return !sameFn && !sameStamp;
    });
    if (entry.handlers.length === 0) this.#routes.delete(id);
    return this;
  }

  #register() {
    if (this.__once) return;
    this.__once = true;

    for (const [id, { method, path }] of this.#routes.entries()) {
      if (method in this.#raw) {
        this.#raw.on(method, path, (ctx, next) =>
          this.#dispatch(id, ctx, next),
        );
      }
    }
  }
}
