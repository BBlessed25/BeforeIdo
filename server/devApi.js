import handler from "../api/singles-register.js";

// Use the same server handler locally as on Vercel. Secrets stay in Node.
export function singlesDevApi() {
  return {
    name: "singles-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/singles-register", async (request, response) => {
        const reply = {
          setHeader: (name, value) => response.setHeader(name, value),
          status(code) {
            response.statusCode = code;
            return this;
          },
          json(body) {
            response.end(JSON.stringify(body));
            return this;
          },
          end: () => response.end(),
        };
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of request) {
            size += chunk.length;
            if (size > 16_384) {
              reply.status(413).json({ ok: false, message: "The request is too large." });
              return;
            }
            chunks.push(chunk);
          }
          request.body = Buffer.concat(chunks).toString("utf8");
          await handler(request, reply);
        } catch {
          if (!response.writableEnded) {
            reply.status(400).json({ ok: false, message: "Could not read the request." });
          }
        }
      });
    },
  };
}
