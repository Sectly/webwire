/**
 * Fastify plugin for WebWire. Requires `@fastify/websocket` to be registered
 * on the Fastify instance before this plugin.
 *
 * @example
 * import Fastify from 'fastify'
 * import websocket from '@fastify/websocket'
 * import { WebWireServer } from '@webwire/server'
 * import { webwire } from '@webwire/fastify'
 *
 * const fastify = Fastify()
 * const wire = new WebWireServer()
 *
 * await fastify.register(websocket)
 * await fastify.register(webwire, { wireServer: wire, prefix: '/wire' })
 *
 * await fastify.listen({ port: 3000 })
 */

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ wireServer: import('@webwire/server').WebWireServer }} opts
 * @returns {Promise<void>}
 */
export async function webwire(fastify, opts) {
  const { wireServer } = opts;

  fastify.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );

  fastify.get("/", { websocket: true }, (socket, req) => {
    const handler = wireServer.createConnection(
      (data) => socket.send(data),
      () => socket.close(),
      req,
    );

    socket.on("message", async (raw) => {
      const bytes = raw instanceof Buffer ? new Uint8Array(raw) : new Uint8Array(raw);
      await handler.onData(bytes);
    });

    socket.on("close", () => handler.onClose());
    socket.on("error", () => handler.onClose());
  });

  fastify.post("/connect", async (req, reply) => {
    const res = await wireServer.handleRequest(toFetchRequest(req));
    return sendFetchResponse(res, reply);
  });

  fastify.get("/poll", async (req, reply) => {
    const res = await wireServer.handleRequest(toFetchRequest(req));
    return sendFetchResponse(res, reply);
  });

  fastify.post("/send", async (req, reply) => {
    const res = await wireServer.handleRequest(toFetchRequest(req));
    return sendFetchResponse(res, reply);
  });
}

/**
 * Adapt a Fastify request to a Fetch API `Request`.
 * @param {import('fastify').FastifyRequest} req
 * @returns {Request}
 */
function toFetchRequest(req) {
  const url = `http://${req.headers.host ?? "localhost"}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) v.forEach(h => headers.append(k, h));
  }

  const init = { method: req.method, headers };

  if (req.method !== "GET" && req.method !== "HEAD") {
    // Fastify has already parsed the body; serialize back to bytes.
    const body = req.body;
    if (body instanceof Uint8Array || body instanceof Buffer) {
      init.body = body;
    } else if (typeof body === "string") {
      init.body = body;
    } else if (body !== undefined && body !== null) {
      init.body = JSON.stringify(body);
    }
  }

  return new Request(url, init);
}

/**
 * Write a Fetch API `Response` back through Fastify's reply.
 * @param {Response} res
 * @param {import('fastify').FastifyReply} reply
 * @returns {Promise<void>}
 */
async function sendFetchResponse(res, reply) {
  reply.status(res.status);
  for (const [k, v] of res.headers.entries()) {
    reply.header(k, v);
  }
  const buf = await res.arrayBuffer();
  reply.send(buf.byteLength > 0 ? Buffer.from(buf) : null);
}
