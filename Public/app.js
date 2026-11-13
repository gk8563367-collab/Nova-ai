
const form = document.getElementById("chat-form");
const input = document.getElementById("message");
const chat = document.getElementById("chat");

let history = [];

function addMessage(text, type) {
  const message = document.createElement("div");
  message.className = "message " + type;
  message.textContent = text;
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const prompt = input.value.trim();
  if (!prompt) return;

  addMessage(prompt, "user");
  history.push({ role: "user", text: prompt });
  input.value = "";

  const loading = document.createElement("div");
  loading.className = "message bot";
  loading.textContent = "WANDER AI is thinking...";
  chat.appendChild(loading);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    });

    const data = await response.json();
    loading.remove();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    const reply = data.answer || "No reply received.";
    addMessage(reply, "bot");
    history.push({ role: "assistant", text: reply });

  } catch (error) {
    loading.remove();
    addMessage("Error: " + error.message, "bot");
  }
});
