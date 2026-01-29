require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  logger: true,
  debug: true
});

transporter.sendMail(
  {
    from: `Genie Test <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: "Genie Email Test",
    text: "If you received this, email sending works."
  },
  (err, info) => {
    if (err) {
      console.error("EMAIL ERROR:", err);
    } else {
      console.log("EMAIL SENT:", info.response);
    }
  }
);
