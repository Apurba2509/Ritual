import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useRef, useState } from 'react';
import { toast } from '@/data/ui';

/**
 * Talk to Ritual: speech → text with live partial results. Uses Android's recognizer (on-device
 * where the language pack is installed) and the Web Speech API in Chrome / Safari.
 */
export function useVoiceInput(onText: (text: string, isFinal: boolean) => void) {
  const [listening, setListening] = useState(false);
  const callback = useRef(onText);
  callback.current = onText;

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (e) => {
    const transcript = e.results[0]?.transcript ?? '';
    if (transcript) callback.current(transcript, e.isFinal);
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    if (e.error === 'aborted' || e.error === 'no-speech' || e.error === 'speech-timeout') return;
    if (e.error === 'not-allowed') toast('Allow the microphone to log by voice', { tone: 'error' });
    else if (e.error === 'service-not-allowed' || e.error === 'language-not-supported')
      toast('Speech recognition isn’t available on this device', { tone: 'error' });
    else toast('Didn’t catch that. Try again?', { icon: 'microphone' });
  });

  const start = async () => {
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        toast('Speech recognition isn’t available here', { tone: 'error' });
        return;
      }
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        toast('Allow the microphone to log by voice', { tone: 'error' });
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: Intl.DateTimeFormat().resolvedOptions().locale || 'en-US',
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
      });
    } catch {
      toast('Speech recognition isn’t available here', { tone: 'error' });
    }
  };

  const stop = () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // already stopped
    }
  };

  return { listening, start, stop };
}
