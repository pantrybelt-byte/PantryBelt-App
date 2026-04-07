import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = {
    dark: boolean;
    toggle: () => void;
    bg: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
    input: string;
};

const ThemeContext = createContext<Theme>({
    dark: false,
    toggle: () => {},
    bg: '#f2f2f7',
    card: '#ffffff',
    text: '#1c1c1e',
    subtext: '#6c6c70',
    border: '#e5e5ea',
    input: '#f2f2f7',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [dark, setDark] = useState(false);

    // Load saved preference on mount
    useEffect(() => {
        AsyncStorage.getItem('darkMode').then(val => {
            if (val === 'true') setDark(true);
        });
    }, []);

    const toggle = () => {
        setDark(d => {
            const next = !d;
            AsyncStorage.setItem('darkMode', String(next));
            return next;
        });
    };

    const theme: Theme = {
        dark,
        toggle,
        bg: dark ? '#1c1c1e' : '#f2f2f7',
        card: dark ? '#2c2c2e' : '#ffffff',
        text: dark ? '#ffffff' : '#1c1c1e',
        subtext: dark ? '#aeaeb2' : '#6c6c70',
        border: dark ? '#3a3a3c' : '#e5e5ea',
        input: dark ? '#3a3a3c' : '#f2f2f7',
    };

    return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
