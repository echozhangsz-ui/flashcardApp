import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { ApiError, loginWithEmail } from "../api/client";
import { setCurrentUser } from "../db/database";
import { RootStackParamList } from "../../App";
import { useSystemLanguage } from "../i18n";

type Nav = StackNavigationProp<RootStackParamList, "AccountAuth">;

export default function AccountAuthScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useSystemLanguage();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreateAccount = () => {
    navigation.navigate("EmailRegister", {
      displayName: displayName.trim(),
      email: email.trim(),
      password,
    });
  };

  const submit = async () => {
    const cleanEmail = email.trim();
    if (!displayName.trim() || !cleanEmail || !password) {
      Alert.alert(t("signInTitle"), "Please enter your name, email, and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await loginWithEmail(cleanEmail, password, displayName);
      await setCurrentUser(user);
      navigation.goBack();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 404) {
        Alert.alert(
          "Account not found",
          "This account does not exist. Would you like to create it?",
          [
            { text: t("cancel"), style: "cancel" },
            { text: t("ok"), onPress: openCreateAccount },
          ]
        );
        return;
      }
      Alert.alert("Sign in failed", e.message ?? "Please try again.");
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
            <Ionicons name="log-in-outline" size={34} color="#6fbd8a" />
          </View>
          <Text style={styles.title}>{t("signInTitle")}</Text>
          <Text style={styles.subtitle}>{t("signInSubtitle")}</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>{t("name")}</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t("yourDisplayName")}
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
            placeholder={t("yourPassword")}
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
                <Ionicons name="log-in-outline" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>{t("signIn")}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.createLink} onPress={openCreateAccount} activeOpacity={0.78}>
            <Text style={styles.createLinkText}>{t("createYourAccount")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  title: { color: "#1a1a2e", fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: {
    color: "#637083",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 320,
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
  createLink: { alignItems: "center", paddingTop: 18, paddingBottom: 4 },
  createLinkText: {
    color: "#6fbd8a",
    fontSize: 14,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
});
