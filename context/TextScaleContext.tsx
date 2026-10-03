import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { setGlobalTextScale } from '../theme/tokens';

export type TextSizeOption = 'standard' | 'large' | 'extra-large';

export const TEXT_SIZE_STORAGE_KEY = '@pb_text_size';

export const TEXT_SCALES: Record<TextSizeOption, number> = {
    'standard': 1.0,
    'large': 1.15,
    'extra-large': 1.3,
};

type TextScaleContextType = {
    textSize: TextSizeOption;
    setTextSize: (size: TextSizeOption) => void;
    scale: number;
};

const TextScaleContext = createContext<TextScaleContextType>({
    textSize: 'standard',
    setTextSize: () => {},
    scale: 1.0,
});

export function TextScaleProvider({ children }: { children: React.ReactNode }) {
    const [textSize, setTextSizeState] = useState<TextSizeOption>('standard');

    useEffect(() => {
        AsyncStorage.getItem(TEXT_SIZE_STORAGE_KEY)
            .then(val => {
                if (val === 'standard' || val === 'large' || val === 'extra-large') {
                    setTextSizeState(val);
                    setGlobalTextScale(TEXT_SCALES[val]);
                }
            })
            .catch(() => {});
    }, []);

    const setTextSize = (size: TextSizeOption) => {
        setTextSizeState(size);
        setGlobalTextScale(TEXT_SCALES[size]);
        AsyncStorage.setItem(TEXT_SIZE_STORAGE_KEY, size).catch(() => {});
    };

    return (
        <TextScaleContext.Provider value={{ textSize, setTextSize, scale: TEXT_SCALES[textSize] }}>
            {children}
        </TextScaleContext.Provider>
    );
}

export const useTextScale = () => useContext(TextScaleContext);
