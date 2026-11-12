# NOVA AI

A responsive, futuristic AI chat website powered by the Gemini API. The API key stays on the Node.js server.

## Included
- Gemini API chat (text and image input)
- Local chat history, new chats, search, clear history
- Copy answers, regenerate, read answers aloud
- Browser voice input where supported
- Text-file attachments (TXT, MD, CSV)
- Image attachments (PNG, JPG, WEBP, GIF)
- Dark/light theme and response-style settings
- Mobile responsive layout

## Requirements
- Node.js 18 or newer
- A Gemini API key with access to a free-tier model
- Follow the API provider's age, account and usage terms. If you are not eligible to create an API account, ask a parent or guardian to help; do not bypass age requirements.

Google's free tier has model-specific rate limits and availability. It is not unlimited. Check the current official pricing and rate-limit pages:
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits

## Run locally
1. Extract the ZIP.
2. Open a terminal in the `nova-ai` folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy `.env.example` to a new file named `.env`.
5. Put your API key after `GEMINI_API_KEY=` in `.env`. Do not share the key or upload `.env`.
6. Start the server:
   ```bash
   npm start
   ```
7. Open `http://localhost:3000`.

## Important
- Do not put the API key in `public/app.js`, `public/index.html`, or any browser-side code.
- Do not publish `.env` or commit it to Git.
- Chat history is saved in the browser's local storage on that device.
- Image uploads are sent to the Gemini API when you submit the message. Text files are read in your browser and their text is sent with the message.
- This starter does not include AI image generation, PDF/DOCX parsing, account login, cloud-synced history, or public multi-user hosting. Those need additional services and implementation.
- Before public deployment, add authentication, abuse protection, rate limiting, request-size limits, privacy disclosures and appropriate hosting security.
