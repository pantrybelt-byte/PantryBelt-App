import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Linking,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

type Props = {
    visible: boolean;
    type: 'terms' | 'privacy';
    onClose: () => void;
};

export default function LegalModal({ visible, type, onClose }: Props) {
    const theme = useTheme();

    const isTerms = type === 'terms';
    const title = isTerms ? 'Terms of Service' : 'Privacy Policy';
    const webUrl = isTerms ? 'https://accessbelt.com/terms' : 'https://accessbelt.com/privacy';

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
                    <Text style={[styles.effectiveDate, { color: theme.subtext }]}>
                        Effective Date: August 2026 · AccessBelt
                    </Text>

                    {isTerms ? (
                        <View style={styles.sectionWrap}>
                            <Text style={[styles.heading, { color: theme.text }]}>1. Acceptance of Terms</Text>
                            <Text style={[styles.paragraph, { color: theme.subtext }]}>
                                By accessing or using AccessBelt, you agree to be bound by these Terms of Service. If you do not agree, you must not use the app or website.
                            </Text>

                            <Text style={[styles.heading, { color: theme.text }]}>2. Description of Service & FTC Positioning</Text>
                            <Text style={[styles.paragraph, { color: theme.subtext }]}>
                                AccessBelt is an independent community resource directory. AccessBelt does not operate, manage, stock, or guarantee any third-party food pantry or distribution center. All listings are for general informational purposes only.
                            </Text>

                            <View style={[styles.warningBox, { backgroundColor: theme.dark ? '#3b1212' : '#fef2f2', borderColor: '#b5252540' }]}>
                                <Text style={styles.warningTitle}>3. Limitation of Liability (Crowd-Sourced Data)</Text>
                                <Text style={[styles.paragraph, { color: theme.dark ? '#fca5a5' : '#991b1b' }]}>
                                    AccessBelt aggregates information from public sources and crowd-sourced submissions. THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE". ACCESSBELT DISCLAIMS ALL WARRANTIES AND SHALL NOT BE LIABLE FOR ANY DAMAGES, FUEL COSTS, TRAVEL EXPENSES, MISSED DISTRIBUTIONS, OR RELIANCE LOSSES.
                                </Text>
                            </View>

                            <Text style={[styles.heading, { color: theme.text }]}>4. User-Generated Content (UGC) & Moderation</Text>
                            <Text style={[styles.paragraph, { color: theme.subtext }]}>
                                Users may submit pantry updates or feedback. You grant AccessBelt a perpetual, royalty-free license to use submitted content. AccessBelt enforces a strict zero-tolerance moderation policy and retains the right to edit, decline, or remove any UGC at any time without notice.
                            </Text>

                            <Text style={[styles.heading, { color: theme.text }]}>5. Binding Arbitration & Class Action Waiver</Text>
                            <Text style={[styles.paragraph, { color: theme.subtext }]}>
                                You agree that disputes arising out of AccessBelt shall be resolved through final binding individual arbitration. YOU WAIVE ALL RIGHTS TO PARTICIPATE IN CLASS ACTIONS OR COLLECTIVE PROCEEDINGS.
                            </Text>

                            <Text style={[styles.heading, { color: theme.text }]}>6. DMCA Takedown Notice</Text>
                            <Text style={[styles.paragraph, { color: theme.subtext }]}>
                                Direct copyright takedown notices under 17 U.S.C. § 512 to our designated contact: getaccessbelt@gmail.com.
                            </Text>

                            <Text style={[styles.heading, { color: theme.text }]}>7. Contact Us</Text>
                            <Text style={[styles.paragraph, { color: theme.subtext }]}>
                                Legal inquiries: getaccessbelt@gmail.com
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.sectionWrap}>
                            <View style={[styles.promiseBox, { backgroundColor: theme.dark ? '#1e293b' : '#eff6ff' }]}>
                                <Text style={[styles.promiseTitle, { color: '#2563eb' }]}>Our Promise</Text>
                                <Text style={[styles.paragraph, { color: theme.text, fontWeight: '500' }]}>
                                    We never sell your personal data, and we never share it with third parties for marketing purposes.
                                </Text>
                            </View>

                            <Text style={[styles.heading, { color: theme.text }]}>1. Information We Collect</Text>
                            <Text style={[styles.paragraph, { color: theme.subtext }]}>
                                • Anonymous by default: No login required to browse pantries.{'\n'}
                                • Coarse Location: Rounded coords (~1 mi resolution) used in-app for map display and county aggregate coverage stats.{'\n'}
                                • Optional Profile: Demographics (optional).{'\n'}
                                • Pete AI Assistant: Input sanitized to remove identifiers before processing.
                            </Text>

                            <Text style={[styles.heading, { color: theme.text }]}>2. How We Use Data</Text>
                            <Text style={[styles.paragraph, { color: theme.subtext }]}>
                                Data is used solely to show nearby pantries, moderate feedback, and provide aggregate county-level impact reports to partner food banks.
                            </Text>

                            <Text style={[styles.heading, { color: theme.text }]}>3. Third-Party Services</Text>
                            <Text style={[styles.paragraph, { color: theme.subtext }]}>
                                We use Google Firebase (database/auth) and Google Gemini API (Pete assistant).
                            </Text>

                            <Text style={[styles.heading, { color: theme.text }]}>4. Contact & Data Rights</Text>
                            <Text style={[styles.paragraph, { color: theme.subtext }]}>
                                Request profile deletion anytime by emailing: getaccessbelt@gmail.com
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.webBtn, { backgroundColor: theme.dark ? '#334155' : '#f1f5f9' }]}
                        onPress={() => Linking.openURL(webUrl)}
                    >
                        <Text style={[styles.webBtnText, { color: '#0071e3' }]}>Open Full Version on Web ({webUrl})</Text>
                        <Ionicons name="open-outline" size={16} color="#0071e3" />
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    closeBtn: { padding: 4 },
    body: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    effectiveDate: { fontSize: 12, marginBottom: 16, fontWeight: '600' },
    sectionWrap: { gap: 14 },
    heading: { fontSize: 16, fontWeight: '700', marginTop: 8 },
    paragraph: { fontSize: 14, lineHeight: 22 },
    warningBox: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 6, marginVertical: 6 },
    warningTitle: { fontSize: 15, fontWeight: '800', color: '#b52525' },
    promiseBox: { padding: 16, borderRadius: 14, gap: 6, marginBottom: 10 },
    promiseTitle: { fontSize: 15, fontWeight: '800' },
    webBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, marginTop: 24 },
    webBtnText: { fontSize: 13, fontWeight: '700' },
});
