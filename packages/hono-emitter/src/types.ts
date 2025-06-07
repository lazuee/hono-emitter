import { type Context, type Hono } from "hono";
import { type HonoBase } from "hono/hono-base";
import {
  type BlankInput,
  type HandlerResponse,
  type Input,
  type Next,
  type ToSchema,
  type TypedResponse,
} from "hono/types";
import { type HonoEmitter } from ".";

type AnyCase<M extends string> = Capitalize<M> | M | Uppercase<M>;

type RemoveDoubleSlashes<S extends string> =
  S extends `${infer Head}//${infer Tail}`
    ? RemoveDoubleSlashes<`${Head}/${Tail}`>
    : S;
type TrimStart<T extends string> = T extends ` ${infer R}` ? TrimStart<R> : T;
type TrimEnd<T extends string> = T extends `${infer R} ` ? TrimEnd<R> : T;
type Trim<T extends string> = TrimStart<TrimEnd<T>>;
type Awaitable<T> = PromiseLike<T> | T;

type GetEnv<T extends HonoBase = Hono> =
  T extends Hono<infer E, any, any> ? E : never;
type GetSchema<T extends HonoBase = Hono> =
  T extends Hono<any, infer S, any> ? S : never;
type GetBasePath<T extends HonoBase = Hono> =
  T extends Hono<any, any, infer P> ? Exclude<P, ""> : never;
type GetPath<
  H extends HonoBase = Hono,
  P extends string = string,
> = RemoveDoubleSlashes<`${GetBasePath<H>}/${Trim<P>}`>;
type MergeTypedResponse<T> =
  T extends Promise<infer T2>
    ? T2 extends TypedResponse
      ? T2
      : TypedResponse
    : T extends TypedResponse
      ? T
      : TypedResponse;

export type HandlerArgs<
  H extends HonoBase = Hono,
  P extends string = string,
  I extends Input = BlankInput,
> = [c: Context<GetEnv<H>, GetPath<H, P>, I>, next: Next];
export type Handler<
  H extends HonoBase = Hono,
  P extends string = string,
  I extends Input = BlankInput,
  R extends HandlerResponse<any> = any,
> = (this: HonoEmitter<H>, ...args: HandlerArgs<H, P, I>) => Awaitable<R>;
export type MiddlewareHandler<
  H extends HonoBase = Hono,
  P extends string = string,
  I extends Input = BlankInput,
  R extends Response | void = any,
> = (
  this: HonoExtend<H, P, I, R>,
  ...args: HandlerArgs<H, P, I>
) => Awaitable<R>;

export type HTTPMethod = "delete" | "get" | "patch" | "post" | "put";
export type RoutePath<K extends string> =
  K extends `${AnyCase<HTTPMethod>}:${infer P}` ? P : K;
export type RouteMethod<K extends string> = K extends `${infer M}:${string}`
  ? M
  : K;
export type RouteHandler<
  H extends HonoBase = Hono,
  K extends string = string,
  I extends Input = BlankInput,
  R extends HandlerResponse<any> = any,
> = Handler<H, RoutePath<K>, I, R> | MiddlewareHandler<H, RoutePath<K>, I>;
export type RouteEvent<H extends HonoBase = Hono> = {
  [K in `${AnyCase<HTTPMethod>}:${string}`]: RouteHandler<H, K>;
};
export type HonoExtend<
  H extends HonoBase = Hono,
  K extends string = any,
  I extends Input = BlankInput,
  R extends HandlerResponse<any> | Response | void = any,
> = HonoEmitter<
  //@ts-expect-error - incompatible schema
  HonoBase<
    GetEnv<H>,
    GetSchema<H> &
      ToSchema<
        RouteMethod<K>,
        GetPath<H, RoutePath<K>>,
        I,
        MergeTypedResponse<R>
      >,
    GetBasePath<H>
  >
>;
