import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("Email service is not configured.");
    }

    await resend.emails.send({
        from: "Life Tracker <onboarding@resend.dev>",
        to,
        subject,
        html,
    });
};

export default sendEmail;
