import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { FeedbackCategory, submitFeedback } from '../utils/feedback';

const CATEGORIES: FeedbackCategory[] = ['Bug', 'Pantry info wrong', 'Feature request', 'Other'];
const MAX_MESSAGE_LENGTH = 500;

type Props = {
    visible: boolean;
    onClose: () => void;
    screenName: string;
    /** Shows a "Not now" button instead of just the close icon — used by the auto-prompt. */
    onNotNow?: () => void;
};

export default function FeedbackModal({ visible, onClose, screenName, onNotNow }: Props) {
    const theme = useTheme();

    const [rating, setRating] = useState(0);
    const [category, setCategory] = useState<FeedbackCategory>('Other');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Reset the form each time the modal is (re)opened.
    useEffect(() => {
        if (visible) {
            setRating(0);
            setCategory('Other');
            setMessage('');
            setEmail('');
            setSubmitting(false);
            setSubmitted(false);
        }
    }, [visible]);

    const canSubmit = rating > 0 && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        await submitFeedback({
            rating,
            category,
            message: message.trim(),
            email: email.trim() ? email.trim() : null,
            screenName,
        });
        setSubmitting(false);
        setSubmitted(true);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.avoidWrap}
                pointerEvents="box-none"
            >
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    <View style={styles.handle} />

                    {submitted ? (
                        <View style={styles.thankYouWrap}>
                            <Ionicons name="checkmark-circle" size={56} color="#16a34a" />
                            <Text style={[styles.thankYouTitle, { color: theme.text }]}>Thank you!</Text>
                            <Text style={[styles.thankYouText, { color: theme.subtext }]}>
                                Your feedback helps us make AccessBelt better for families across Alabama.
                            </Text>
                            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                                <Text style={styles.doneBtnText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.header}>
                                <Text style={[styles.title, { color: theme.text }]}>Send Feedback</Text>
                                <TouchableOpacity onPress={onClose}>
                                    <Ionicons name="close-circle" size={28} color={theme.subtext} />
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.label, { color: theme.text }]}>How's the app working for you?</Text>
                            <View style={styles.starsRow}>
                                {[1, 2, 3, 4, 5].map(n => (
                                    <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                                        <Ionicons
                                            name={n <= rating ? 'star' : 'star-outline'}
                                            size={34}
                                            color={n <= rating ? '#f59e0b' : theme.subtext}
                                            style={styles.star}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.label, { color: theme.text }]}>What's this about?</Text>
                            <View style={styles.chipsRow}>
                                {CATEGORIES.map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[
                                            styles.chip,
                                            { backgroundColor: theme.input, borderColor: theme.border },
                                            category === c && styles.chipActive,
                                        ]}
                                        onPress={() => setCategory(c)}
                                    >
                                        <Text style={[styles.chipText, { color: theme.text }, category === c && styles.chipTextActive]}>
                                            {c}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.label, { color: theme.text }]}>Tell us more (optional)</Text>
                            <TextInput
                                style={[styles.textArea, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]}
                                placeholder="What happened? What would you like to see?"
                                placeholderTextColor={theme.subtext}
                                multiline
                                maxLength={MAX_MESSAGE_LENGTH}
                                value={message}
                                onChangeText={setMessage}
                            />
                            <Text style={[styles.charCount, { color: theme.subtext }]}>{message.length}/{MAX_MESSAGE_LENGTH}</Text>

                            <Text style={[styles.label, { color: theme.text }]}>Can we follow up with you?</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]}
                                placeholder="Email (optional)"
                                placeholderTextColor={theme.subtext}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={email}
                                onChangeText={setEmail}
                            />

                            <TouchableOpacity
                                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                                onPress={handleSubmit}
                                disabled={!canSubmit}
                            >
                                <Text style={styles.submitBtnText}>{submitting ? 'Sending…' : 'Submit Feedback'}</Text>
                            </TouchableOpacity>

                            {onNotNow && (
                                <TouchableOpacity style={styles.notNowBtn} onPress={onNotNow}>
                                    <Text style={[styles.notNowText, { color: theme.subtext }]}>Not now</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    avoidWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, maxHeight: '88%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
    handle: { width: 40, height: 4, backgroundColor: '#e5e5ea', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    title: { fontSize: 20, fontWeight: '800' },
    label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 14 },
    starsRow: { flexDirection: 'row', gap: 6 },
    star: { marginRight: 2 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
    chipActive: { backgroundColor: '#b52525', borderColor: '#b52525' },
    chipText: { fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: '#fff' },
    textArea: { borderRadius: 12, borderWidth: 1, padding: 12, minHeight: 90, fontSize: 14, textAlignVertical: 'top' },
    charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },
    input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14 },
    submitBtn: { backgroundColor: '#b52525', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
    submitBtnDisabled: { opacity: 0.4 },
    submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    notNowBtn: { alignItems: 'center', paddingVertical: 14 },
    notNowText: { fontSize: 13, fontWeight: '600' },
    thankYouWrap: { alignItems: 'center', paddingVertical: 20, gap: 10 },
    thankYouTitle: { fontSize: 20, fontWeight: '800' },
    thankYouText: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
    doneBtn: { backgroundColor: '#b52525', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 40, marginTop: 12 },
    doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
