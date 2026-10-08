// Serves the static design mockups in this folder: `node design/serve.mjs`, then open http://localhost:5190
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT) || 5190;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };

createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = join(root, normalize(path === "/" ? "/today-directions.html" : path));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    try {
        const body = await readFile(file);
        res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }).end(body);
    } catch {
        res.writeHead(404).end("Not found");
    }
}).listen(port, "127.0.0.1", () => console.log(`Design mockups on http://localhost:${port}`));
