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
      console.log('[ScreenRecorder] Getting desktop sources...');

      // Get available desktop sources (screens and windows)
      const sources = await window.electronAPI.getDesktopSources();

      if (!sources || sources.length === 0) {
        throw new Error('No screen sources available');
      }

      console.log('[ScreenRecorder] Found sources:', sources.length);

      // Use the first screen (usually the main display)
      const screenSource = sources.find(s => s.name.includes('Screen') || s.name.includes('Entire'));
      const sourceId = screenSource ? screenSource.id : sources[0].id;

      console.log('[ScreenRecorder] Using source:', sourceId);

      // Get media stream using Electron's chromeMediaSource
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080
          }
        } as any
      });

      streamRef.current = stream;
      console.log('[ScreenRecorder] Screen capture stream acquired');

      // Try different codecs until one works
      const codecs = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm;codecs=h264',
        'video/webm',
        'video/mp4'
      ];

      console.log('[ScreenRecorder] Checking codec support:');
      codecs.forEach(codec => {
        const supported = MediaRecorder.isTypeSupported(codec);
        console.log(`  ${codec}: ${supported ? 'YES' : 'NO'}`);
      });

      let supportedCodec = null;
      for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
          supportedCodec = codec;
          console.log('[ScreenRecorder] Selected codec:', codec);
          break;
        }
      }

      // Create MediaRecorder with supported codec or let it use default
      let mediaRecorder;
      try {
        mediaRecorder = supportedCodec
          ? new MediaRecorder(stream, { mimeType: supportedCodec })
          : new MediaRecorder(stream);

        if (!supportedCodec) {
          console.log('[ScreenRecorder] Using browser default codec');
        }
      } catch (err) {
        console.error('[ScreenRecorder] MediaRecorder creation failed:', err);
        throw new Error(`Failed to create MediaRecorder: ${err instanceof Error ? err.message : String(err)}`);
      }

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to start recording.\n\nError: ${errorMessage}\n\nPlease make sure screen capture permissions are granted.`);
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
        const showInFolder = confirm(
          `Recording saved successfully!\n\nLocation: ${result.path}\n\nClick OK to show in folder, or Cancel to close.`
        );
        if (showInFolder) {
          await window.electronAPI.showRecordingInFolder(result.path);
        }
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
