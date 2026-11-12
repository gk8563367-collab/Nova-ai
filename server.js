require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", (_req, res) => {
  res.json({ configured: Boolean(API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "The API key is not configured. Add GEMINI_API_KEY to your .env file and restart the server."
      });
    }

    const { messages, systemInstruction } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Please send a message." });
    }

    // Keep requests bounded and accept only the content types this demo supports.
    const contents = messages.slice(-20).map((message) => {
      const role = message.role === "model" ? "model" : "user";
      const parts = [];
      if (typeof message.text === "string" && message.text.trim()) {
        parts.push({ text: message.text.slice(0, 12000) });
      }
      if (Array.isArray(message.images)) {
        for (const image of message.images.slice(0, 2)) {
          if (
            image &&
            typeof image.mimeType === "string" &&
            /^image\/(png|jpeg|webp|gif)$/.test(image.mimeType) &&
            typeof image.data === "string" &&
            image.data.length <= 5_000_000
          ) {
            parts.push({
              inline_data: {
                mime_type: image.mimeType,
                data: image.data
              }
            });
          }
        }
      }
      return { role, parts };
    }).filter(item => item.parts.length);

    if (!contents.length) {
      return res.status(400).json({ error: "There is no text or supported image to send." });
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
      const message = data?.error?.message || `Gemini API error (${response.status})`;
      return res.status(response.status).json({ error: message });
    }

    const answer = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return res.status(502).json({ error: "The AI returned an empty response. Please try again." });
    }

    res.json({ answer });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Server error. Check your connection and try again." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`NOVA AI is running at http://localhost:${PORT}`);
});
