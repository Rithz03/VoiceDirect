import axios from "axios";

const ELEVENLABS_API_KEY = process.env.REACT_APP_ELEVEN_API_KEY;

// Converting speech-to-text
export async function speechToText(audioBlob) {
    try {
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.mp4");
        formData.append("model_id", "scribe_v1");

        const resp = await axios.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            formData,
            {
                headers: {
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "multipart/form-data",
                },
            }
        );

        return resp.data.text;
    } catch (error) {
        console.error("Speech to text conversion failed:", error);
        throw error;
    }
}

// Converting text to speech with additional options
export async function textToSpeech(text, voiceID = "pNInz6obpgDQGcFmaJgB", options = {}) {
    try {
        const requestBody = {
            text,
            model_id: options.model_id || "eleven_multilingual_v2",
            voice_settings: options.voice_settings || {
                stability: 0.5,
                similarity_boost: 0.5
            }
        };

        const resp = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceID}`,
            requestBody,
            {
                headers: {
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                responseType: "blob"
            }
        );

        return resp.data;
    } catch (error) {
        console.error("Text to speech conversion failed:", error);
        throw error;
    }
}
