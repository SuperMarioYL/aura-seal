import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipRecorder, recordingSupported, type RecordedClip } from './recorder';

/**
 * React lifecycle wrapper around ClipRecorder. `start(onClip)` begins recording and
 * invokes `onClip` once recording ends — whether the user stopped it or it hit the
 * max-duration auto-stop.
 */
export function useRecorder(
  getVideo: () => HTMLVideoElement | null,
  getEffectCanvas: () => HTMLCanvasElement | null,
) {
  const recorderRef = useRef<ClipRecorder | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const intervalRef = useRef(0);
  const finishingRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const start = useCallback(
    (onClip: (clip: RecordedClip | null) => void): boolean => {
      const video = getVideo();
      if (!video || recorderRef.current) {
        return false;
      }

      const recorder = new ClipRecorder(video, getEffectCanvas);
      const finish = async () => {
        if (finishingRef.current) {
          return;
        }
        finishingRef.current = true;
        window.clearInterval(intervalRef.current);
        const clip = await recorder.stop();
        recorderRef.current = null;
        finishRef.current = null;
        setIsRecording(false);
        setElapsedMs(0);
        finishingRef.current = false;
        onClip(clip);
      };

      const ok = recorder.start(() => void finish());
      if (!ok) {
        return false;
      }

      recorderRef.current = recorder;
      finishRef.current = () => void finish();
      setIsRecording(true);
      intervalRef.current = window.setInterval(() => setElapsedMs(recorder.elapsedMs), 200);
      return true;
    },
    [getVideo, getEffectCanvas],
  );

  const stop = useCallback(() => {
    finishRef.current?.();
  }, []);

  useEffect(() => {
    return () => {
      window.clearInterval(intervalRef.current);
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, []);

  return { supported: recordingSupported(), isRecording, elapsedMs, start, stop };
}
