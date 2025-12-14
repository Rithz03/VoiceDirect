import { useState, useRef, useEffect } from "react";
import { personalities } from "./personalities";
import { askGemini } from "./services/gemini";
import { speechToText, textToSpeech } from "./services/elevenlabs";

function App() {
  const [reply, setReply] = useState("");
  const [audioURL, setAudioURL] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [mode, setMode] = useState("chill_gz");
  const persona = personalities[mode];
  const [chatHistory, setChatHistory] = useState([]);
  const [state, setState] = useState("idle");
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
    };
  }, [audioURL]);

  async function startRecording() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioURL("");
    }

    if (state === "speaking")
      return;
    if (isRecording)
      return;
    setState("listening");
    setError(null);
    setIsRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.start();
      console.log("Recording started.");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Could not access microphone.");
      setIsRecording(false);
    }
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current)
      return null;
    if (mediaRecorderRef.current.state === "inactive") {
      return null;
    }
    setIsRecording(false);

    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/mp4" });
        chunksRef.current = [];
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
      console.log("Recording stopped.");
    });
  }

  async function handleProcess() {
    if (!isRecording)
      return;
    if (state === "thinking")
      return;
    if (state === "speaking")
      return;

    try {
      const audioBlob = await stopRecording();

      if (!audioBlob) {
        console.warn("No audio recorded.");
        return;
      }

      // STT
      const userText = await speechToText(audioBlob);
      console.log("User Text:", userText);

      setState("thinking");
      // Gemini
      const newHistory = [
        ...chatHistory,
        {
          role: "user",
          content: persona.prompt + "\nUser said: " + userText
        }
      ];

      //Ask Gemini with memory
      const aiReply = await askGemini(newHistory);

      //save conversation history
      //save conversation history
      const updatedHistory = [
        ...newHistory,
        {
          role: "assistant",
          content: aiReply
        }
      ];
      setChatHistory(updatedHistory.slice(-6));
      setReply(aiReply);

      // TTS
      const audio = await textToSpeech(aiReply, persona.voiceId);
      const url = URL.createObjectURL(audio);
      setAudioURL(url);
      setState("speaking");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
      setState("idle");
    }
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>VoiceDirect AI</h1>
      </header>

      <div className="controls-top">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="select-mode"
        >
          {Object.entries(personalities).map(([key, p]) => (
            <option key={key} value={key}>{p.label}</option>
          ))}
        </select>

        <button
          className="btn-secondary"
          onClick={() => {
            setChatHistory([]);
            setReply("");
            setAudioURL("");
            setState("idle");
          }}
        >
          Reset
        </button>
      </div>

      <main className="main-content">
        <div className="orb-container">
          <div className={`orb ${state} ${isRecording ? 'listening' : ''}`}></div>
        </div>

        <div className="status-label">
          {isRecording ? "Listening..." :
            state === "thinking" ? "Thinking..." :
              state === "speaking" ? "Speaking..." : "Tap & Hold to Speak"}
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="response-area">
          {reply && (
            <div className="ai-messages">
              {reply}
            </div>
          )}
        </div>

        {/* Hidden Audio Player */}
        {audioURL && (
          <audio
            ref={audioRef}
            src={audioURL}
            autoPlay
            onEnded={() => setState("idle")}
            style={{ display: 'none' }}
          />
        )}
      </main>

      <footer className="controls-bottom">
        <button
          className={`mic-button ${isRecording ? 'recording' : ''}`}
          onMouseDown={startRecording}
          onMouseUp={handleProcess}
          onMouseLeave={stopRecording}
          aria-label="Hold to speak"
        >
          {isRecording ? "REC" : "TALK"}
        </button>
      </footer>
    </div>
  );
}

export default App;
