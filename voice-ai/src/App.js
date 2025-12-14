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
    <div style={{ padding: 40 }}>
      <h2>AI Voice Test</h2>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: 20 }}>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {Object.entries(personalities).map(([key, p]) => (
            <option key={key} value={key}>{p.label}</option>
          ))}
        </select>

        <button onClick={() => {
          setChatHistory([]);
          setReply("");
          setAudioURL("");
        }}>
          Reset Conversation
        </button>

        <button
          onMouseDown={startRecording}
          onMouseUp={handleProcess}
          onMouseLeave={stopRecording} /* Safety: stop if they drag out */
        >Hold to Speak</button>

        {isRecording && <span style={{ color: 'red', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>● Recording...</span>}
      </div>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <p>{reply}</p>

      {audioURL && <audio ref={audioRef} controls autoPlay src={audioURL} onEnded={() => setState("idle")} />}
      <p>
        {state === "listening" && "Listening..."}
        {state === "thinking" && "Thinking..."}
        {state === "speaking" && "Speaking..."}
      </p>
      <p>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </p>
    </div>
  );
}

export default App;
