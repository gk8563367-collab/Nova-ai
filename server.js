
require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GROQ_API_KEY;

app.use(express.json({ limit: "12mb" }));

// Serve all website files from public
app.use(express.static(path.join(__dirname, "public")));

// API status
app.get("/api/status", (_req, res) => {
  res.json({ configured: Boolean(API_KEY) });
});

// AI Chat
app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "Groq API key is not configured."
      });
    }

    const { messages, systemInstruction } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Please send a message."
      });
    }

    const groqMessages = [];

    if (typeof systemInstruction === "string" && systemInstruction.trim()) {
      groqMessages.push({
        role: "system",
        content: systemInstruction.slice(0, 3000)
      });
    }

    for (const message of messages.slice(-20)) {
      if (!message || typeof message.text !== "string" || !message.text.trim()) {
        continue;
      }

      groqMessages.push({
        role:
          message.role === "model" || message.role === "assistant"
            ? "assistant"
            : "user",
        content: message.text.slice(0, 12000)
      });
    }

    if (!groqMessages.length) {
      return res.status(400).json({
        error: "Please send a text message."
      });
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: groqMessages,
          max_completion_tokens: 1024
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Groq API error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "Groq API request failed."
      });
    }

    const answer = data.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return res.status(502).json({
        error: "The AI returned an empty response."
      });
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
  console.log(`WANDER AI is running on port ${PORT}`);
});
