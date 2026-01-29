require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const { Resend } = require("resend");

const { createState, handleInput } = require("./genie");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

/* EMAIL (RESEND) */
const resend = new Resend(process.env.RESEND_API_KEY);
console.log(
  "🔑 RESEND_API_KEY present:",
  !!process.env.RESEND_API_KEY,
  process.env.RESEND_API_KEY?.slice(0, 5)
);

function sendEmail(subject, body) {
  // 🔥 fire-and-forget (never block Twilio)
  resend.emails
    .send({
      from: "Genie <onboarding@resend.dev>",
   to: ["sherene@rancedesigns.com"],
      subject,
      text: body
    })
    .catch(err => console.error("Email failed:", err));
}
// 🔎 DEBUG: confirm env is loaded
console.log(
  "🔑 RESEND_API_KEY present:",
  !!process.env.RESEND_API_KEY
);

/* TEST EMAIL ROUTE */
app.get("/test-email", async (req, res) => {
  try {
    await resend.emails.send({
      from: "Genie <onboarding@resend.dev>",
      to: ["sherene@rancedesigns.com"], // 👈 hardcode for now
      subject: "Resend Test Email",
      text: "If you received this, Resend works 🎉"
    });

    res.send("✅ Test email sent successfully");
  } catch (err) {
    console.error("❌ Test email failed:", err);
    res.status(500).send("❌ Test email failed");
  }
});

/* SESSIONS */
const sessions = new Map();
function getSession(sid) {
  if (!sessions.has(sid)) sessions.set(sid, createState());
  return sessions.get(sid);
}
function endSession(sid) {
  sessions.delete(sid);
}
app.get("/test-email", async (req, res) => {
  console.log("🧪 Test email route hit");

  try {
    await resend.emails.send({
      from: "Genie <onboarding@resend.dev>",
      to: ["sherene@rancedesigns.com"], // hardcoded on purpose
      subject: "Resend Test Email",
      text: "If you got this, Resend works on Render."
    });

    res.send("✅ Test email sent");
  } catch (err) {
    console.error("❌ Test email failed:", err);
    res.status(500).send("Email failed");
  }
});

/* WEBHOOK */
app.post("/voice", async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid;
  const state = getSession(callSid);

  const input =
    (req.body.Digits && req.body.Digits.trim()) ||
    (req.body.SpeechResult && req.body.SpeechResult.trim()) ||
    "";

  const result = await handleInput(input, state);

  /* ===== END CALL (SINGLE EXIT) ===== */
  if (result.endCall) {
    // ✅ GUARANTEED SUMMARY if name + phone captured
    if (state.nameFormatted && state.phone) {
      console.log("📧 Attempting to send summary email", {
  name: state.nameFormatted,
  phone: state.phone
});

      sendEmail(
        "Call Summary",
        `
CALL SUMMARY

Name: ${state.nameFormatted}
Phone: ${state.phone}

Project:
${state.projectDetails || "N/A"}

Answered Questions:
${state.answeredQuestions.join("\n") || "None"}

Unanswered Questions:
${state.unansweredQuestions.join("\n") || "None"}

NOTE:
Call ended or disconnected.
`
      );
    }

    twiml.say(
      { voice: "Polly.Joanna" },
      result.reply || "Thank you for calling. Goodbye."
    );
    twiml.hangup();
    endSession(callSid);
    return res.type("text/xml").send(twiml.toString());
  }

  /* ===== KEEP CALL OPEN ===== */
  const gather = twiml.gather({
    action: "/voice",
    method: "POST",
    input: "speech dtmf",
    speechTimeout: "auto",
    timeout: 4,
    bargeIn: true
  });

  if (result.reply) {
    gather.say({ voice: "Polly.Joanna" }, result.reply);
  }

  res.type("text/xml").send(twiml.toString());
});

app.listen(3000, () => {
  console.log("🎧 Voice server running on port 3000");
});


