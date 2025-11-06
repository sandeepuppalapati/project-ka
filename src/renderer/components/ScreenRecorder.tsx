import { useState, useRef, useEffect } from 'react';
import { Video, Square, Circle } from 'lucide-react';
import './ScreenRecorder.css';

interface ScreenRecorderProps {
  onClose?: () => void;
}

export function ScreenRecorder({ onClose }: ScreenRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      // Use standard screen capture API
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      streamRef.current = stream;

      // Try different codecs until one works
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await saveRecording();
      };

      // Start recording
      mediaRecorder.start(1000); // Capture data every second
      setIsRecording(true);

      // Start timer
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Please make sure screen capture permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const saveRecording = async () => {
    setIsSaving(true);

    try {
      // Create blob from chunks
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });

      // Convert blob to array buffer
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Save via IPC
      const result = await window.electronAPI.saveRecording(uint8Array);

      if (result.success && result.path) {
        alert(`Recording saved successfully!\n\nLocation: ${result.path}`);
      } else {
        alert(`Failed to save recording: ${result.error}`);
      }

      // Reset
      chunksRef.current = [];
      setDuration(0);
    } catch (error) {
      console.error('Failed to save recording:', error);
      alert(`Error saving recording: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="screen-recorder">
      {!isRecording && !isSaving ? (
        <button className="start-recording-btn" onClick={startRecording}>
          <Circle size={16} />
          Start Recording
        </button>
      ) : isSaving ? (
        <div className="recording-status saving">
          <Video size={16} />
          <span>Saving...</span>
        </div>
      ) : (
        <div className="recording-controls">
          <div className="recording-indicator">
            <div className="recording-dot pulsing" />
            <span className="recording-duration">{formatDuration(duration)}</span>
          </div>
          <button className="stop-recording-btn" onClick={stopRecording}>
            <Square size={14} />
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
