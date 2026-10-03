/**
 * utils/voicePrefs.ts — Pete dictation preference (device-local).
 *
 * Off by default and stored only in AsyncStorage: never synced to Firestore,
 * and dictation never involves the app recording audio.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DICTATION_KEY } from '../constants/storageKeys';

async function getFlag(key: string): Promise<boolean> {
    try {
        return (await AsyncStorage.getItem(key)) === 'true';
    } catch {
        return false;
    }
}

/** Shows the dictation (mic) control in Pete's message bar. */
export const getDictationEnabled = () => getFlag(DICTATION_KEY);
export const setDictationEnabled = (on: boolean) => AsyncStorage.setItem(DICTATION_KEY, on ? 'true' : 'false');
