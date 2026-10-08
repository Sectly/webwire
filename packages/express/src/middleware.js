/**
 * @param {import('@webwirejs/server').WebWireServer} wireServer
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void}
 */
export function webwire(wireServer) {
  let upgradeAttached = false;

  const handler = async (req, res, next) => {
    const url = `http://${req.headers.host ?? "localhost"}${req.originalUrl ?? req.url}`;

    let body = null;
    if (req.method === "POST") {
      body = await readBody(req);
    }

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === "string") headers.set(k, v);
      else if (Array.isArray(v)) v.forEach(h => headers.append(k, h));
    }

    const fetchReq = new Request(url, { method: req.method, headers, body: body || undefined });
    const response = await wireServer.handleRequest(fetchReq);

    if (!response) return next();

    res.status(response.status);
    for (const [k, v] of response.headers.entries()) {
      res.set(k, v);
    }
    const buf = await response.arrayBuffer();
    res.end(buf.byteLength > 0 ? Buffer.from(buf) : undefined);
  };

  return (req, res, next) => {
    if (!upgradeAttached) {
      upgradeAttached = true;
      const server = req.socket?.server ?? req.connection?.server;
      if (server) wireServer.attach(server);
    }
    handler(req, res, next).catch(next);
  };
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
