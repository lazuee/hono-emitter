import { type Context } from "hono";
import { type Hono } from "hono";
import { type hc } from "hono/client";
import { type HonoBase } from "hono/hono-base";
import {
  type BlankInput,
  type HandlerResponse,
  type Input,
  type Next,
  type ToSchema,
  type TypedResponse,
} from "hono/types";
import { type UnionToIntersection } from "hono/utils/types";
import { type HonoEmitter } from ".";

export type IfUnionAny<T> = [T] extends [UnionToIntersection<T>] ? T : any;
type AnyCase<M extends string> = Capitalize<M> | M | Uppercase<M>;
type RemoveDoubleSlashes<S extends string> = S extends `${infer H}//${infer T}`
  ? RemoveDoubleSlashes<`${H}/${T}`>
  : S;
type TrimStart<T extends string> = T extends ` ${infer R}` ? TrimStart<R> : T;
type TrimEnd<T extends string> = T extends `${infer R} ` ? TrimEnd<R> : T;
type Trim<T extends string> = TrimStart<TrimEnd<T>>;
type Awaitable<T> = PromiseLike<T> | T;
type SplitPath<S extends string> = S extends `/${infer Rest}`
  ? SplitPath<Rest>
  : S extends `${infer Head}/${infer Tail}`
    ? [Head, ...SplitPath<Tail>]
    : S extends ""
      ? []
      : [S];
type GetNestedValue<T, Keys extends string[]> = Keys extends [
  infer K,
  ...infer R,
]
  ? K extends keyof T
    ? R extends string[]
      ? GetNestedValue<T[K], R>
      : never
    : never
  : T;

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

export type SchemaRoutes<H extends HonoBase = Hono> = {
  [K in keyof GetSchema<H>]: {
    [M in `$${HTTPMethod}` &
      keyof GetSchema<H>[K]]: `${Lowercase<M extends `$${infer I}` ? I : never>}:${Extract<K, string>}`;
  }[`$${HTTPMethod}` & keyof GetSchema<H>[K]];
}[keyof GetSchema<H>];
export type SchemaRoutesEmit<H extends HonoBase> = {
  [K in SchemaRoutes<H>]: K extends `${infer M}:${infer P}`
    ? `$${M}` extends keyof GetNestedValue<
        ReturnType<typeof hc<H>>,
        SplitPath<P>
      >
      ? GetNestedValue<
          ReturnType<typeof hc<H>>,
          SplitPath<P>
        >[`$${M}`] extends (...args: any) => any
        ? GetNestedValue<ReturnType<typeof hc<H>>, SplitPath<P>>[`$${M}`]
        : never
      : never
    : never;
};
