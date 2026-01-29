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

function sendEmail(subject, body) {
  // 🔥 fire-and-forget (never block Twilio)
  resend.emails
    .send({
      from: "Genie <onboarding@resend.dev>",
      to: [process.env.EMAIL_USER],
      subject,
      text: body
    })
    .catch(err => console.error("Email failed:", err.message));
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

  /* ===== END CALL (SINGLE EXIT) ===== */
  if (result.endCall) {
    // ✅ GUARANTEED SUMMARY if name + phone captured
    if (state.nameFormatted && state.phone) {
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


