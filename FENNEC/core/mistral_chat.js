// Chat UI and Mistral placeholder integration for FENNEC.
// Provides a simple chat interface using the local Mistral model if available.

function sendToMistral(prompt) {
    // Placeholder for local model inference. Replace with actual model call.
    return Promise.resolve("Mistral model not available.");
}

function initMistralChat() {
    const box = document.getElementById("mistral-chat");
    if (!box) return;
    const input = document.getElementById("mistral-input");
    const sendBtn = document.getElementById("mistral-send");
    const log = document.getElementById("mistral-log");

    function appendMessage(text, who) {
        const div = document.createElement("div");
        div.className = "mistral-msg " + who;
        div.textContent = text;
        log.appendChild(div);
        div.style.opacity = "0";
        requestAnimationFrame(() => { div.style.opacity = "1"; });
        log.scrollTop = log.scrollHeight;
    }

    async function handleSend() {
        const text = input.value.trim();
        if (!text) return;
        appendMessage(text, "user");
        input.value = "";
        try {
            const resp = await sendToMistral(text);
            appendMessage(resp, "ai");
        } catch (e) {
            console.error("[Mistral]", e);
            appendMessage("Error", "ai");
        }
    }

    sendBtn.addEventListener("click", handleSend);
    input.addEventListener("keypress", e => {
        if (e.key === "Enter") handleSend();
    });
}
