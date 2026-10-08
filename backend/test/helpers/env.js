// Test configuration. Import this before anything from the app, so the app never sees real settings.
// (app.js loads .env, but values already set here are left alone.)

process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRET = "test-access-token-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-token-secret";
process.env.CLIENT_URL = "http://localhost:5173";

// No email can leave a test run: the key is made up, and the Resend client is pointed at this machine.
// helpers/email.js replaces the address with a stand-in server that collects what the app sends.
process.env.RESEND_API_KEY = "re_test_key";
process.env.RESEND_BASE_URL = "http://127.0.0.1:9";
process.env.EMAIL_FROM = "";
process.env.EMAIL_VERIFICATION_REQUIRED = "";
process.env.GMAIL_CLIENT_ID = "";
process.env.GMAIL_CLIENT_SECRET = "";
process.env.GMAIL_REFRESH_TOKEN = "";

// Lets every test client have its own address, so rate limits apply per client as they would in production
process.env.CLIENT_IP_HEADER = "x-test-client-ip";
