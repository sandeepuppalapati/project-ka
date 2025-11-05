import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import './VoiceRecorder.css';
import { AlertTriangle } from 'lucide-react';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export interface VoiceRecorderHandle {
  toggleRecording: () => void;
}

type RecordingState = 'idle' | 'recording';

export const VoiceRecorder = forwardRef<VoiceRecorderHandle, VoiceRecorderProps>(
  function VoiceRecorder({ onTranscription, disabled = false }, ref) {
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopRecording();
    };
  }, []);

  const setupAudioProcessing = async (stream: MediaStream) => {
    // Create audio context
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    const source = audioContextRef.current.createMediaStreamSource(stream);

    // Setup analyzer for visualization
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    source.connect(analyserRef.current);

    // Setup audio processor for sending to WebSocket
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      // Convert to 16-bit PCM
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Send to WebSocket as base64
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
      wsRef.current.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64
      }));
    };

    source.connect(processor);
    processor.connect(audioContextRef.current.destination);

    // Start audio level visualization
    updateAudioLevel();
  };

  const updateAudioLevel = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / bufferLength;
    setAudioLevel(average / 255);

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  const startRecording = async () => {
    try {
      setError(null);
      setLiveTranscript('');

      // Get OpenAI API key
      const settings = await window.electronAPI.getSettings();
      if (!settings.openaiApiKey) {
        setError('OpenAI API key not configured. Please add it in Settings.');
        return;
      }

      // Connect to OpenAI Realtime API
      const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', [
        'realtime',
        `openai-insecure-api-key.${settings.openaiApiKey}`,
        'openai-beta.realtime-v1'
      ]);

      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('Connected to OpenAI Realtime API');

        // Configure session for transcription only
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text'],
            instructions: 'Transcribe the user audio.',
            input_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            }
          }
        }));

        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 24000,
            channelCount: 1,
          }
        });

        streamRef.current = stream;
        await setupAudioProcessing(stream);
        setState('recording');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Handle transcription updates
        if (data.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = data.transcript;
          setLiveTranscript(transcript);
          onTranscription(transcript);
        } else if (data.type === 'conversation.item.input_audio_transcription.delta') {
          // Incremental transcription updates
          const delta = data.delta;
          setLiveTranscript(prev => prev + delta);
        } else if (data.type === 'error') {
          console.error('Realtime API error:', data.error);
          setError(data.error.message || 'Transcription error');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error. Please try again.');
        stopRecording();
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        if (state === 'recording') {
          stopRecording();
        }
      };

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setState('idle');
    }
  };

  const stopRecording = () => {
    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setAudioLevel(0);
    setState('idle');
  };

  const handleClick = () => {
    if (disabled) return;

    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  };

  const getButtonIcon = () => {
    return state === 'idle' ? '🎤' : '🔴';
  };

  const getButtonTitle = () => {
    return state === 'idle'
      ? 'Start voice input (Cmd/Ctrl+Shift+V)'
      : 'Stop recording';
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    toggleRecording: handleClick,
  }));

  return (
    <div className="voice-recorder">
      <button
        className={`voice-button ${state}`}
        onClick={handleClick}
        disabled={disabled}
        title={getButtonTitle()}
      >
        <span className="icon">{getButtonIcon()}</span>
        {state === 'recording' && (
          <div
            className="audio-level"
            style={{ width: `${audioLevel * 100}%` }}
          />
        )}
      </button>

      {error && (
        <div className="voice-error" title={error}>
          <AlertTriangle size={16} />
        </div>
      )}

      {state === 'recording' && (
        <div className="recording-indicator">
          <div>
            <span className="pulse-dot" />
            Recording...
          </div>
          {liveTranscript && (
            <div className="live-transcript">
              {liveTranscript}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
