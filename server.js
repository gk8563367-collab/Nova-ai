
require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json({ limit: "12mb" }));

// Serve the homepage and files from the main repository folder
app.use(express.static(__dirname));

app.get("/api/status", (_req, res) => {
  res.json({ configured: Boolean(API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "The API key is not configured."
      });
    }

    const { messages, systemInstruction } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Please send a message." });
    }

    const contents = messages.slice(-20).map((message) => {
      const role = message.role === "model" ? "model" : "user";
      const parts = [];

      if (typeof message.text === "string" && message.text.trim()) {
        parts.push({ text: message.text.slice(0, 12000) });
      }

      return { role, parts };
    }).filter(item => item.parts.length);

    if (!contents.length) {
      return res.status(400).json({ error: "Please send text." });
    }

    const body = { contents };

    if (typeof systemInstruction === "string" && systemInstruction.trim()) {
      body.system_instruction = {
        parts: [{ text: systemInstruction.slice(0, 3000) }]
      };
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API error"
      });
    }

    const answer = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return res.status(502).json({ error: "Empty AI response." });
    }

    res.json({ answer });

  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: "Server error. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`NOVA AI is running on port ${PORT}`);
});
