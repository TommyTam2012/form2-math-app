console.log("🟢 script.js loaded successfully");

const responseBox = document.getElementById("responseBox");
const questionInput = document.getElementById("questionInput");
const historyList = document.getElementById("historyList");
const micBtn = document.getElementById("micBtn");

const translationBox = document.createElement("div");
translationBox.id = "chineseTranslation";
translationBox.style.marginTop = "10px";
translationBox.style.fontSize = "0.95em";
translationBox.style.color = "#333";
responseBox.insertAdjacentElement("afterend", translationBox);

let currentExamId = "";

function setExam(examId) {
  currentExamId = examId;
  const pdfUrl = `/exam/math/${examId}.pdf`;
  window.open(pdfUrl, "_blank");
  console.log(`📘 Exam set to ${examId}`);
}

function clearHistory() {
  historyList.innerHTML = "";
  console.log("🧹 History cleared");
}

function cleanLatexMarkdown(text) {
  let cleaned = text
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\*\*/g, '')
    .replace(/#{1,6}/g, '')
    .replace(/\\/g, '')
    .trim();

  cleaned = cleaned.replace(/(Answer:\s*)([^\n]+)/gi, '<strong>$1$2</strong>');
  return cleaned;
}

async function submitQuestion() {
  const question = questionInput.value.trim();
  if (!question || !currentExamId) {
    alert("⚠️ 請選擇試卷並輸入問題");
    return;
  }

  responseBox.textContent = "正在分析中，請稍候...";
  translationBox.textContent = "";

  const imageMessages = [{ type: "text", text: question }];
  let missingCount = 0;
  const maxMissing = 3;
  const maxAttempts = 10;

  for (let i = 1; i <= maxAttempts; i++) {
    const url = `${window.location.origin}/exam/math/${currentExamId}page${i}.png`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        imageMessages.push({ type: "image_url", image_url: { url } });
        console.log(`✅ Found: ${url}`);
        missingCount = 0;
      } else {
        console.warn(`❌ Not found: ${url}`);
        missingCount++;
      }
    } catch (err) {
      console.warn(`⚠️ Error checking: ${url}`, err);
      missingCount++;
    }
    if (missingCount >= maxMissing) {
      console.log("🛑 Stopping image loop after too many missing pages.");
      break;
    }
  }

  fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: question, messages: imageMessages })
  })
    .then(async res => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error: ${text}`);
      }
      return res.json();
    })
    .then(data => {
      const answer = data.response || "❌ 無法獲取英文回答。";
      const translated = data.translated || "❌ 無法翻譯為中文。";
      const cleanedAnswer = cleanLatexMarkdown(answer);
      responseBox.innerHTML = cleanedAnswer;
      translationBox.textContent = `🇨🇳 中文翻譯：${translated}`;
      addToHistory(question, `${cleanedAnswer}<br><em>🇨🇳 中文翻譯：</em>${translated}`);
    })
    .catch(err => {
      responseBox.textContent = "❌ 發生錯誤，請稍後重試。";
      console.error("GPT error:", err);
    });

  questionInput.value = "";
}

function addToHistory(question, answer) {
  const li = document.createElement("li");
  li.innerHTML = `<strong>問：</strong>${question}<br/><strong>答：</strong>${answer}`;
  historyList.prepend(li);
}

// ----------------- 🔊 TTS Engine -----------------

function detectLang(text) {
  return /[一-龥]/.test(text) ? "zh-CN" : "en-GB";
}

let cachedVoices = [];
window.speechSynthesis.onvoiceschanged = () => {
  cachedVoices = speechSynthesis.getVoices();
};

function getVoiceForLang(lang) {
  if (!cachedVoices.length) cachedVoices = speechSynthesis.getVoices();
  return cachedVoices.find(v => v.lang === lang)
    || cachedVoices.find(v => v.name.includes(lang.includes("zh") ? "普通话" : "English"))
    || cachedVoices[0];
}

function chunkText(text, maxLength = 180) {
  const chunks = [];
  let current = '';
  const parts = text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) || [text];

  for (const part of parts) {
    if ((current + part).length > maxLength) {
      if (current) chunks.push(current.trim());
      current = part;
    } else {
      current += part;
    }
  }

  if (current) chunks.push(current.trim());
  return chunks;
}

async function speakTextChunks(chunks, lang) {
  for (let i = 0; i < chunks.length; i++) {
    await new Promise(resolve => {
      const utter = new SpeechSynthesisUtterance(chunks[i]);
      utter.lang = lang;
      utter.voice = getVoiceForLang(lang);
      utter.rate = 1;
      utter.onend = () => setTimeout(resolve, 250);
      speechSynthesis.speak(utter);
    });
  }
}

async function speakMixed() {
  speechSynthesis.cancel();

  const english = responseBox.textContent.trim();
  const chinese = translationBox.textContent.replace(/^🇨🇳 中文翻譯：/, "").trim();

  const engChunks = chunkText(english);
  const zhChunks = chunkText(chinese);

  await speakTextChunks(engChunks, "en-GB");

  setTimeout(() => {
    speakTextChunks(zhChunks, "zh-CN");
  }, 500);
}

document.getElementById("ttsBtn")?.addEventListener("click", () => {
  speakMixed();
});

document.getElementById("stopTTSBtn")?.addEventListener("click", () => {
  speechSynthesis.cancel();
});

// ----------------- 🎤 Voice Input -----------------

if (window.SpeechRecognition || window.webkitSpeechRecognition) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = false;

  let finalTranscript = "";
  let isHoldingMic = false;
  let restartCount = 0;
  const maxRestarts = 3;

  recognition.onstart = () => {
    micBtn.textContent = "🎤 正在录音... (松开发送)";
    console.log("🎙️ Mic started");
  };

  recognition.onresult = (event) => {
    finalTranscript = event.results[0][0].transcript;
    console.log("📥 Captured:", finalTranscript);
  };

  recognition.onend = () => {
    if (isHoldingMic && restartCount < maxRestarts) {
      console.log("🔁 Restarting mic (hold still active)");
      restartCount++;
      recognition.start();
    } else {
      micBtn.textContent = "🎤 语音提问";
      console.log("🛑 Mic released or max restarts reached");
      if (finalTranscript.trim()) {
        questionInput.value = finalTranscript;
        submitQuestion();
      } else {
        console.log("⚠️ 没有检测到语音內容。");
      }
    }
  };

  recognition.onerror = (event) => {
    console.error("🎤 Speech error:", event.error);
    micBtn.textContent = "🎤 语音提问";
  };

  micBtn.addEventListener("mousedown", () => {
    isHoldingMic = true;
    restartCount = 0;
    finalTranscript = "";
    recognition.start();
  });

  micBtn.addEventListener("mouseup", () => {
    isHoldingMic = false;
    recognition.stop();
  });

  micBtn.addEventListener("touchstart", () => {
    isHoldingMic = true;
    restartCount = 0;
    finalTranscript = "";
    recognition.start();
  });

  micBtn.addEventListener("touchend", () => {
    isHoldingMic = false;
    recognition.stop();
  });
}

window.submitQuestion = submitQuestion;
window.setExam = setExam;
window.clearHistory = clearHistory;
