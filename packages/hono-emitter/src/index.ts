import { Hono, type Context } from "hono";
import { hc } from "hono/client";
import { type HonoBase } from "hono/hono-base";
import {
  type BlankInput,
  type HandlerResponse,
  type Input,
  type Next,
} from "hono/types";
import {
  type HonoExtend,
  type HTTPMethod,
  type IfUnionAny,
  type RouteEvent,
  type RouteHandler,
  type SchemaRoutes,
  type SchemaRoutesEmit,
} from "./types";

const regexLeadingSlash = /^\//;
const DATE = Symbol("dateCreated");
const isPromise = <T>(value: unknown): value is Promise<T> =>
  value !== undefined &&
  value !== null &&
  typeof value === "object" &&
  "then" in value &&
  typeof (value as any).then === "function";

type BaseURL = `http://${string}` | `https://${string}`;
export class HonoEmitter<H extends HonoBase = Hono, S extends BaseURL = any> {
  #raw: H;
  #client: ReturnType<typeof hc<H>>;
  #routes = new Map<
    `${HTTPMethod}:${string}`,
    {
      method: HTTPMethod;
      path: string;
      handlers: [handler: RouteHandler<H, any>, once: boolean][];
    }
  >();
  #baseUrl?: S;

  [key: string]: unknown;

  constructor(hono: H = new Hono() as H, baseUrl?: S) {
    this.#raw = hono;

    if (baseUrl) {
      try {
        this.#baseUrl = new URL(baseUrl).origin as S;
      } catch {
        throw new Error(
          `Invalid base URL: "${baseUrl}" - must be a valid http/https URL`,
        );
      }
    }

    this.#raw.get("/hono-emitter/test", (ctx) => ctx.text("ok")); // test baseUrl
    this.#client = hc<H>(this.#baseUrl ?? "/");

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

  async emit<K extends SchemaRoutes<H>>(
    event: K,
    //@ts-expect-error - unsafe
    ...args: Parameters<IfUnionAny<SchemaRoutesEmit<H>[K]>> extends never
      ? []
      : //@ts-expect-error - unsafe
        Parameters<IfUnionAny<SchemaRoutesEmit<H>[K]>>
    //@ts-expect-error - unsafe
  ): IfUnionAny<ReturnType<SchemaRoutesEmit<H>[K]>> {
    if (!this.#baseUrl) {
      throw new Error("Base URL required - provide it in constructor");
    }

    if (!this.__checkBaseURL) {
      try {
        await this.#getClientRoute(
          `get:${(this.#raw as any)._basePath}/hono-emitter/test`,
        )();
        this.__checkBaseURL = true;
      } catch {
        throw new Error(`Server not reachable at ${this.#baseUrl}`);
      }
    }

    return this.#getClientRoute(event)?.(...args);
  }

  #getClientRoute(event: string) {
    const [method, ...rest] = event.split(":");
    const segments = rest.join(":").split("/").filter(Boolean);
    const target = segments.reduce(
      (obj, key) => (obj as any)?.[key],
      this.#client,
    );

    return (target as any)?.[`$${method}`];
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
