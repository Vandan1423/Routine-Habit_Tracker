import http from "node:http";
import { once } from "node:events";

// Stands in for Resend during tests. The app reaches it through the real Resend client, so emails are
// built and sent exactly as in production, but they end up in this list instead of anyone's inbox.
export const outbox = [];

let refusal = null;
let server;

// Makes the stand-in turn emails away, the way Resend does for a sender that isn't allowed to reach the address
export const refuseEmails = (
    reason = "You can only send testing emails to your own email address.",
) => {
    refusal = reason;
};

export const acceptEmails = () => {
    refusal = null;
};

// Has to run before anything imports the "resend" package, which reads RESEND_BASE_URL once, as it loads
export const startEmailServer = async () => {
    if (server) {
        return;
    }

    server = http.createServer(async (req, res) => {
        let body = "";
        for await (const chunk of req) {
            body += chunk;
        }

        res.setHeader("Content-Type", "application/json");

        if (refusal) {
            res.statusCode = 403;
            res.end(
                JSON.stringify({
                    statusCode: 403,
                    name: "validation_error",
                    message: refusal,
                }),
            );
            return;
        }

        outbox.push(JSON.parse(body));
        res.end(JSON.stringify({ id: `test-email-${outbox.length}` }));
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    process.env.RESEND_BASE_URL = `http://127.0.0.1:${server.address().port}`;
};

export const stopEmailServer = () => {
    server?.close();
    server = undefined;
};

export const emailsTo = (address) =>
    outbox.filter((email) => email.to === address.toLowerCase());

// Some emails are sent after the response has already gone out, so give them a moment to arrive
export const waitForEmailTo = async (address, count = 1) => {
    for (let attempt = 0; attempt < 100; attempt++) {
        const emails = emailsTo(address);
        if (emails.length >= count) {
            return emails.at(-1);
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`No email number ${count} arrived for ${address}`);
};

// The token at the end of the link an email asks its reader to open
export const tokenIn = (email) => email.html.match(/href="[^"]*\/([0-9a-f]{64})"/)[1];
