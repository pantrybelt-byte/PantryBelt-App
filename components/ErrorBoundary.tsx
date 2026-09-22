import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = {
        hasError: false,
        error: null,
    };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught error:', error, errorInfo);
    }

    handleReload = async () => {
        try {
            if (typeof Updates.reloadAsync === 'function') {
                await Updates.reloadAsync();
            } else {
                this.setState({ hasError: false, error: null });
            }
        } catch {
            this.setState({ hasError: false, error: null });
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView style={styles.container}>
                    <View style={styles.card}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="alert-circle-outline" size={36} color="#b52525" />
                        </View>
                        <Text style={styles.title}>Something went wrong</Text>
                        <Text style={styles.subtitle}>
                            An unexpected error occurred. Tap below to reload the app.
                        </Text>
                        <TouchableOpacity style={styles.button} onPress={this.handleReload} activeOpacity={0.8}>
                            <Ionicons name="refresh-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.buttonText}>Tap to reload</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            );
        }
        return this.props.children;
    }
}

export function FallbackErrorBoundary({ error, retry }: { error?: Error; retry?: () => void }) {
    const handleRetry = async () => {
        if (retry) {
            retry();
            return;
        }
        try {
            if (typeof Updates.reloadAsync === 'function') {
                await Updates.reloadAsync();
            }
        } catch {}
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.card}>
                <View style={styles.iconCircle}>
                    <Ionicons name="alert-circle-outline" size={36} color="#b52525" />
                </View>
                <Text style={styles.title}>Something went wrong</Text>
                <Text style={styles.subtitle}>
                    An unexpected error occurred. Tap below to reload the app.
                </Text>
                <TouchableOpacity style={styles.button} onPress={handleRetry} activeOpacity={0.8}>
                    <Ionicons name="refresh-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.buttonText}>Tap to reload</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3EAD8',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        width: '100%',
        maxWidth: 380,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1c1917',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: '#78716c',
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#b52525',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 24,
        width: '100%',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
});

export default ErrorBoundary;
