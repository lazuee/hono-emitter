import { emitter } from ".";

const ping = await emitter.emit("get:/api/ping");
console.log("ping:", await ping.text());
const world = await emitter.emit("get:/api/world");
console.log("world:", await world.text());
const user = await emitter.emit("get:/api/user/:id", { param: { id: "1" } });
console.log("user:", await user.text());

//@ts-expect-error - not available in types (not chained)
const hello = await emitter.emit("get:/api/hello");
console.log("hello:", await (hello as any).text());
