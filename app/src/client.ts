import { hc } from "hono/client";

import { type emitter } from ".";

const client = hc<typeof emitter.app>("/");
client.api.ping.$get();
client.api.world.$get();
// client.api.hello.$get(); // not available in types (not chained)
