import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { registerWithEmail } from "../api/client";
import { CurrentUser, setCurrentUser } from "../db/database";
import { RootStackParamList } from "../../App";
import { useSystemLanguage } from "../i18n";

type Nav = StackNavigationProp<RootStackParamList, "EmailRegister">;
type EmailRegisterRoute = RouteProp<RootStackParamList, "EmailRegister">;

export default function EmailRegisterScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<EmailRegisterRoute>();
  const { t } = useSystemLanguage();
  const [displayName, setDisplayName] = useState(route.params?.displayName ?? "");
  const [email, setEmail] = useState(route.params?.email ?? "");
  const [password, setPassword] = useState(route.params?.password ?? "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<CurrentUser | null>(null);

  const submit = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password || !confirmPassword) {
      Alert.alert(t("createAccount"), "Please enter your email and password.");
      return;
    }
    if (password.length < 8) {
      Alert.alert(t("createAccount"), "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t("createAccount"), "The two passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await registerWithEmail(cleanEmail, password, displayName);
      await setCurrentUser(user);
      setCreatedUser(user);
      setPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      Alert.alert("Create account failed", e.message ?? "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <View style={styles.iconBadge}>
            <Ionicons name="mail-outline" size={34} color="#6fbd8a" />
          </View>
          <Text style={styles.title}>{t("createAccountWithEmail")}</Text>
          <Text style={styles.subtitle}>{t("createAccountSubtitle")}</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>{t("name")}</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t("optional")}
            autoCapitalize="words"
            editable={!isSubmitting}
          />

          <Text style={styles.label}>{t("email")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!isSubmitting}
          />

          <Text style={styles.label}>{t("password")}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            editable={!isSubmitting}
          />

          <Text style={styles.label}>{t("confirmPassword")}</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t("enterSamePassword")}
            secureTextEntry
            editable={!isSubmitting}
          />

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={submit}
            disabled={isSubmitting}
            activeOpacity={0.86}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>{t("createAccount")}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>We store only a protected password hash, not your original password.</Text>
      </ScrollView>

      <Modal visible={Boolean(createdUser)} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop}>
          <View style={styles.successModal}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={30} color="#6fbd8a" />
            </View>
            <Text style={styles.successTitle}>{t("accountCreated")}</Text>
            <Text style={styles.successText}>
              {t("accountCreatedText", { email: createdUser?.email ?? "" })}
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                setCreatedUser(null);
                navigation.navigate("Profile");
              }}
              activeOpacity={0.86}
            >
              <Text style={styles.successButtonText}>{t("ok")}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1 },
  container: { flex: 1, backgroundColor: "#f1f7f2" },
  content: { padding: 16, paddingBottom: 42 },
  headerBlock: { alignItems: "center", paddingTop: 12, paddingBottom: 18 },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e2dc",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { color: "#1a1a2e", fontSize: 23, fontWeight: "800", textAlign: "center" },
  subtitle: {
    color: "#637083",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 16,
  },
  label: { color: "#1a1a2e", fontSize: 14, fontWeight: "800", marginBottom: 8, marginTop: 12 },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e6dc",
    backgroundColor: "#f7fbf8",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#1a1a2e",
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#6fbd8a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  submitButtonDisabled: { opacity: 0.72 },
  submitButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  note: {
    color: "#637083",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
    marginTop: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,0.36)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  successModal: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 22,
    alignItems: "center",
  },
  successIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#eaf8f1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  successTitle: { color: "#1a1a2e", fontSize: 21, fontWeight: "800", textAlign: "center" },
  successText: {
    color: "#637083",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },
  successButton: {
    width: "100%",
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#6fbd8a",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  successButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
