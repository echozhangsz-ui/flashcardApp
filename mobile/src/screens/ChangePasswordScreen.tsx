import React, { useEffect, useState } from "react";
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
import { changePassword } from "../api/client";
import { getCurrentUser } from "../db/database";
import { RootStackParamList } from "../../App";
import { useSystemLanguage } from "../i18n";

type Nav = StackNavigationProp<RootStackParamList, "ChangePassword">;

export default function ChangePasswordScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useSystemLanguage();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user?.email) {
          navigation.navigate("AccountAuth");
          return;
        }
        setEmail(user.email);
      })
      .catch(() => navigation.navigate("AccountAuth"));
  }, [navigation]);

  const submit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t("changePassword"), t("fillAllPasswordFields"));
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert(t("changePassword"), t("newPasswordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t("changePassword"), t("newPasswordsDoNotMatch"));
      return;
    }

    try {
      setIsSubmitting(true);
      await changePassword(email, currentPassword, newPassword);
      Alert.alert(t("passwordChanged"), t("passwordChangedText"), [
        { text: t("ok"), onPress: () => navigation.goBack() },
      ]);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      Alert.alert(t("changePasswordFailed"), e.message ?? t("pleaseTryAgain"));
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
            <Ionicons name="key-outline" size={34} color="#6fbd8a" />
          </View>
          <Text style={styles.title}>{t("changePassword")}</Text>
          <Text style={styles.subtitle}>{email || t("yourAccount")}</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>{t("currentPassword")}</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t("enterCurrentPassword")}
            secureTextEntry
            editable={!isSubmitting}
          />

          <Text style={styles.label}>{t("newPassword")}</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t("atLeast8Characters")}
            secureTextEntry
            editable={!isSubmitting}
          />

          <Text style={styles.label}>{t("confirmNewPassword")}</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t("enterNewPasswordAgain")}
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
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>{t("savePassword")}</Text>
              </>
            )}
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
});
