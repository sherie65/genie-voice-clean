require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const { Resend } = require("resend");

const { createState, handleInput } = require("./genie");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

/* =========================
   EMAIL (RESEND)
========================= */

const resend = new Resend(process.env.RESEND_API_KEY);

// 🔍 diagnostic: proves env var exists on Render
console.log(
  "🔑 RESEND_API_KEY present:",
  !!process.env.RESEND_API_KEY
);

function sendEmail(subject, body) {
  resend.emails
    .send({
      from: "Genie <onboarding@resend.dev>",
      to: ["sherene@rancedesigns.com"], // TEMP hardcoded
      subject,
      text: body
    })
    .then(() => console.log("📧 Email sent"))
    .catch(err =>
      console.error("❌ Email failed:", err)
    );
}

/* =========================
   TEST ROUTES (CRITICAL)
========================= */

// ✅ visit https://genie-voice.onrender.com/test-email
app.get("/test-email", async (req, res) => {
  try {
    await resend.emails.send({
      from: "Genie <onboarding@resend.dev>",
      to: ["sherene@rancedesigns.com"],
      subject: "Resend test from Render",
      text: "If you got this email, Resend works from Render."
    });

    console.log("✅ Test email sent");
    res.send("✅ Email sent");
  } catch (err) {
    console.error("❌ Test email failed:", err);
    res.status(500).send("❌ Email failed");
  }
});

// ✅ visit https://genie-voice.onrender.com/net-test
app.get("/net-test", (req, res) => {
  res.send("✅ Server reachable");
});

/* =========================
   SESSIONS
========================= */

const sessions = new Map();
function getSession(sid) {
  if (!sessions.has(sid)) sessions.set(sid, createState());
  return sessions.get(sid);
}
function endSession(sid) {
  sessions.delete(sid);
}

/* =========================
   TWILIO WEBHOOK
========================= */

app.post("/voice", async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid;
  const state = getSession(callSid);

  const input =
    (req.body.Digits && req.body.Digits.trim()) ||
    (req.body.SpeechResult && req.body.SpeechResult.trim()) ||
    "";

  const result = await handleInput(input, state);

  if (result.endCall) {
    if (state.nameFormatted && state.phone) {
      sendEmail(
        "Call Summary",
        `
Name: ${state.nameFormatted}
Phone: ${state.phone}

Project:
${state.projectDetails || "N/A"}
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

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎧 Voice server running on port ${PORT}`);
});




