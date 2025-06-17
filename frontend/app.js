import React, { useState, useEffect } from "react";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (username && password) {
      setLoggedIn(true);
    } else {
      alert("请输入用户名和密码。");
    }
  };

  // 🧠 Hardcoded answer sheet for now
  const answerKey = {
    "worksheet-a_q1": "120 cm³",
    "worksheet-a_q2": "3.14",
    "worksheet-b_q3": "45°",
    // Add more as needed
  };

  const [selectedExamId, setSelectedExamId] = useState("");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [history, setHistory] = useState([]);

  const detectLang = (text) => /[\u4e00-\u9fa5]/.test(text) ? "zh-CN" : "en-GB";

  const getVoiceForLang = (lang) => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang === lang) ||
           voices.find(v => v.name.includes(lang === "zh-CN" ? "普通话" : "UK English Female"));
  };

  const speakMixed = (text) => {
    const segments = text.split(/(?<=[。.!?])/).map(s => s.trim()).filter(Boolean);
    let index = 0;
    const speakNext = () => {
      if (index >= segments.length) return;
      const segment = segments[index++];
      const utter = new SpeechSynthesisUtterance(segment);
      const lang = detectLang(segment);
      utter.lang = lang;
      utter.voice = getVoiceForLang(lang);
      utter.rate = 1;
      utter.onend = speakNext;
      speechSynthesis.speak(utter);
    };
    speechSynthesis.cancel();
    speakNext();
  };

  const handleSubmit = async () => {
    if (!question || !selectedExamId) {
      alert("⚠️ Please enter a question and select a worksheet.");
      return;
    }

    const key = `${selectedExamId}_${question.toLowerCase().replace(/\s/g, "")}`;
    const officialAnswer = answerKey[key];

    if (!officialAnswer) {
      setResponse("❌ No answer found for this question in the answer sheet.");
      return;
    }

    setResponse("Analyzing with GPT-4o, please wait...");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, officialAnswer }),
      });

      const data = await res.json();
      const english = data.response || "No response.";
      const translated = data.translated || "无中文翻译。";

      const final = `${english}\n\n🇨🇳 中文翻译：${translated}`;
      setResponse(final);
      setHistory(prev => [...prev, { question, answer: final }]);
      setQuestion("");
    } catch (err) {
      console.error("GPT error:", err);
      setResponse("❌ Error occurred. Please try again.");
    }
  };

  useEffect(() => {
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;

    const handleMic = () => recognition.start();
    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript;
      setQuestion(spoken);
      handleSubmit();
    };
    recognition.onerror = (event) => {
      alert("🎤 Speech recognition failed.");
      console.error("Mic error:", event.error);
    };

    window.startVoiceInput = handleMic;
  }, []);

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-100">
        <div className="bg-white p-10 rounded-lg shadow-lg w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-center text-blue-700">
            Tommy Sir's Band 1 英语数学 AI 练习应用程序
          </h2>
          <p className="mb-6 text-center text-gray-600">登录您的账户以开始学习</p>
          <input
            type="text"
            placeholder="请输入用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full mb-4 p-3 border rounded border-blue-300"
          />
          <input
            type="password"
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-6 p-3 border rounded border-blue-300"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            登录
          </button>
        </div>
      </div>
    );
  }

  const exams = [
    { id: "worksheet-a", label: "📗 Worksheet A", pdf: "/exams/worksheet-a.pdf" },
    { id: "worksheet-b", label: "📗 Worksheet B", pdf: "/exams/worksheet-b.pdf" },
  ];

  return (
    <div className="p-6 bg-blue-100 min-h-screen text-gray-800">
      <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">
        Tommy Sir's Band 1 英语数学 AI 练习应用程序
      </h1>

      <div className="mb-6">
        <div className="font-semibold mb-2">📘 选择练习题：</div>
        <div className="flex flex-wrap gap-3">
          {exams.map(exam => (
            <button
              key={exam.id}
              onClick={() => {
                setSelectedExamId(exam.id);
                window.open(exam.pdf, "_blank");
              }}
              className={`px-4 py-2 rounded ${selectedExamId === exam.id ? "bg-blue-700" : "bg-blue-500"} text-white hover:bg-blue-600`}
            >
              {exam.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="font-semibold mb-2">📝 输入问题编号：</div>
        <input
          className="w-full p-2 rounded border border-blue-300"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：Q1 或 Q2"
        />
        <div className="mt-2 flex gap-3">
          <button
            onClick={handleSubmit}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            提交问题
          </button>
          <button
            onClick={() => window.startVoiceInput()}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
          >
            🎤 语音提问
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="font-semibold mb-2">📥 回答结果：</div>
        <div className="bg-white text-gray-700 p-4 rounded min-h-[100px] border border-blue-200 whitespace-pre-wrap">
          {response || "提交问题后将显示答案"}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => speakMixed(response)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            🔊 听回答
          </button>
          <button
            onClick={() => window.speechSynthesis.cancel()}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            🔇 停止播放
          </button>
        </div>
      </div>

      <div>
        <div className="font-semibold mb-2">📜 历史对话：</div>
        {history.length === 0 ? (
          <div className="text-gray-500">暂无历史记录</div>
        ) : (
          <ul className="space-y-3">
            {history.map((item, index) => (
              <li key={index} className="bg-white p-3 rounded border border-blue-200">
                <div className="text-blue-700 text-sm">您问：{item.question}</div>
                <div className="text-green-600 text-sm mt-1">AI 回答：{item.answer}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
