require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const nodemailer = require("nodemailer");

const { createState, handleInput } = require("./genie");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

/* EMAIL */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function sendEmail(subject, body) {
  await transporter.sendMail({
    from: `Genie AI Receptionist <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject,
    text: body
  });
}

/* SESSIONS */
const sessions = new Map();
function getSession(sid) {
  if (!sessions.has(sid)) sessions.set(sid, createState());
  return sessions.get(sid);
}
function endSession(sid) {
  sessions.delete(sid);
}

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

  /* ===== END CALL (SINGLE, FINAL PATH) ===== */
  if (result.endCall) {
    // ✅ Failsafe summary email if name + phone captured
    if (
      result.sideEffects?.sendEmail ||
      (state.nameFormatted && state.phone)
    ) {
if (
  result.sideEffects?.sendEmail ||
  (state.nameFormatted && state.phone)
) {
  sendEmail(
    "Call Summary (Call Ended)",
    `
CALL SUMMARY

Name: ${state.nameFormatted || "Not provided"}
Phone: ${state.phone || "Not provided"}

Project:
${state.projectDetails || "N/A"}

Answered Questions:
${state.answeredQuestions.join("\n") || "None"}

Unanswered Questions:
${state.unansweredQuestions.join("\n") || "None"}

NOTE:
Call ended.
`
  ).catch(err => console.error("Email failed:", err.message));
}

} // ← ✅ ADD THIS LINE (closes the sendEmail IF)

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
    speechTimeout: 1,
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

