// genie.js

function createState() {
  return {
    step: "greeting",
    phoneAttempts: 0,

    projectDetails: "",
    nameRaw: "",
    nameFormatted: "",
    phone: "",
    phoneConfirmed: false,

    completed: false,
    urgent: false,
    appointmentCompleted: false,

    answeredQuestions: [],
    unansweredQuestions: []
  };
}

/* =========================
   HELPERS
========================= */

const normalize = (t = "") => t.toLowerCase().trim();

const missedThat = (q) => `Sorry, I may have missed that. ${q}`;

const isNoResponse = (t = "") =>
  /(no|nope|nah|no thanks|no thank you|that's it|that is it|nothing else|all set|i'm good|im good)/i.test(
    normalize(t)
  );


const isYesResponse = (t = "") =>
  /^(yes|yeah|yep|yup|sure|ok|okay|correct)$/i.test(normalize(t));

/* BUSINESS FAQ */
function answerBusinessQuestion(input) {
  if (/email/.test(input)) {
    return "You can reach us by email at info at reality construction dot com.";
  }
  if (/address|location/.test(input)) {
    return "Our office is located at 123 Union Street, Brooklyn, New York.";
  }
  if (/hours|open|close|time/.test(input)) {
    return "Our hours are Monday through Friday, from 9 AM to 6 PM.";
  }
  return null;
}

const summarizeProject = (t = "") => {
  const x = normalize(t);
  if (x.includes("bath")) return "Bathroom renovation";
  if (x.includes("kitchen")) return "Kitchen renovation";
  if (x.includes("tile")) return "Tile work";
  if (x.includes("roof")) return "Roof work";
  return "Home improvement project";
};

const speakDigits = (d = "") => d.split("").join(" ");

const formatName = (raw = "") =>
  raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

/* =========================
   MAIN BRAIN
========================= */

async function handleInput(text, state) {
  if (!state) {
    return { reply: "Sorry, something went wrong. Please call back.", endCall: true };
  }

  const input = normalize(text || "");

  /* GLOBAL BUSINESS FAQ — works anywhere */
  const businessAnswer = answerBusinessQuestion(input);
  if (businessAnswer) {
    state.answeredQuestions.push(text);
    return {
      reply: `${businessAnswer} Is there anything else I can help you with?`,
      endCall: false
    };
  }

  /* GREETING */
  if (state.step === "greeting") {
    state.step = "project";
    return {
      reply: "Hi, you’ve reached Reality Construction. This is Genie. How can I help you today?",
      endCall: false
    };
  }

  /* PROJECT */
  if (state.step === "project") {
    if (!input) {
      return { reply: missedThat("How can I help you today?"), endCall: false };
    }

    state.projectDetails = text;
    state.step = "name";
    return {
      reply: `Got it — you’re calling about ${summarizeProject(text)}. May I have your first name and how to spell it?`,
      endCall: false
    };
  }

  /* NAME */
  if (state.step === "name") {
    if (!input) {
      return { reply: missedThat("May I have your first name and how to spell it?"), endCall: false };
    }

    state.nameRaw = text;
    state.nameFormatted = formatName(text);
    state.step = "phone";
    return {
      reply: "Thanks. What’s the best 10-digit phone number to reach you?",
      endCall: false
    };
  }

  /* PHONE */
  if (state.step === "phone") {
    state.phoneAttempts += 1;
    const digits = (text || "").replace(/\D/g, "");

    if (digits.length !== 10) {
      return {
        reply: "I didn’t get all ten digits. Please repeat the number, or enter it using your keypad.",
        endCall: false
      };
    }

    state.phone = digits;
    state.step = "confirm";
    return {
      reply: `Just to confirm, is ${speakDigits(digits)} the best number to reach you?`,
      endCall: false
    };
  }

  /* CONFIRM PHONE */
  if (state.step === "confirm") {
    if (isNoResponse(input)) {
      state.step = "phone";
      return {
        reply: "Okay, please enter your phone number again using your keypad.",
        endCall: false
      };
    }

    state.phoneConfirmed = true;
    state.step = "appointment_offer";
    return {
      reply: "Great, thank you. Would you like to set an appointment? I can text you a scheduling link to this number.",
      endCall: false
    };
  }

  /* APPOINTMENT OFFER */
  if (state.step === "appointment_offer") {
    if (isNoResponse(input)) {
      state.step = "post_appointment";
      return {
        reply: "No problem. Someone from our team will follow up with you. Is there anything else I can help you with?",
        endCall: false
      };
    }

    state.step = "appointment_confirm";
    return {
      reply: `Great. I’ll send the link to ${speakDigits(state.phone)}. Is that okay?`,
      endCall: false
    };
  }

  /* APPOINTMENT CONFIRM */
  if (state.step === "appointment_confirm") {
    state.appointmentCompleted = true;
    state.step = "post_appointment";
    return {
      reply: "Perfect. I’ve sent the scheduling link. Is there anything else I can help you with today?",
      endCall: false
    };
  }

/* POST-APPOINTMENT / GENERAL Q&A */

  // ✅ EXIT FIRST if user says no
if (state.step === "post_appointment") {

  // 🚨 EXIT IMMEDIATELY ON NO
  if (isNoResponse(input)) {
    return {
      reply: "Thank you for calling Reality Construction. Have a great day!",
      endCall: true,
      sideEffects: { sendEmail: true }
    };
  }

  // everything else comes AFTER


  // Known questions
  if (input.includes("address")) {
    return {
      reply: "Our address is 123 Union Street, Brooklyn, New York. Anything else I can help with?",
      endCall: false
    };
  }

  if (input.includes("hours")) {
    return {
      reply: "We’re open Monday through Friday, 9 AM to 6 PM. Anything else I can help with?",
      endCall: false
    };
  }

  if (input.includes("email")) {
    return {
      reply: "You can reach us at info@realityconstruction.com. Anything else I can help with?",
      endCall: false
    };
  }

  // Unknown question
  state.unansweredQuestions.push(text);
  return {
    reply:
      "That’s a great question. Someone from our team will follow up with you. Is there anything else I can help you with?",
    endCall: false
  };
}





  /* FALLBACK */
  return {
    reply: missedThat("Can you tell me a bit more about what you need?"),
    endCall: false
  };
}

module.exports = { createState, handleInput };

