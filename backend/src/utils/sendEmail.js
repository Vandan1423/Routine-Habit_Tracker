import dns from "dns";
import nodemailer from "nodemailer";

dns.setDefaultResultOrder("ipv4first");

const sendEmail = async ({ to, subject, html }) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("Email service is not configured.");
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS, // Gmail App Password, not your real password
        },
        family: 4,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
    });

    await transporter.sendMail({
        from: `"Life Tracker" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};

export default sendEmail;
