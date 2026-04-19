import React, { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import {
  clearCurrentUser,
  CurrentUser,
  getCurrentUser,
  getDailyStudyGoal,
  getLocalLearningStats,
  SystemLanguage,
  updateDailyStudyGoal,
} from "../db/database";
import { RootStackParamList } from "../../App";
import {
  SYSTEM_LANGUAGE_OPTIONS,
  systemLanguageLabel,
  useSystemLanguage,
} from "../i18n";

type LearningStats = {
  deckCount: number;
  cardCount: number;
  studiedToday: number;
};

type Nav = StackNavigationProp<RootStackParamList, "Profile">;

const DEFAULT_STATS: LearningStats = {
  deckCount: 0,
  cardCount: 0,
  studiedToday: 0,
};

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { language, t, setLanguage } = useSystemLanguage();
  const [stats, setStats] = useState<LearningStats>(DEFAULT_STATS);
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(null);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(20);
  const [dailyGoalDraft, setDailyGoalDraft] = useState("20");
  const [dailyGoalModalVisible, setDailyGoalModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const isSignedIn = Boolean(currentUser);

  useFocusEffect(
    useCallback(() => {
      getLocalLearningStats().then(setStats).catch(() => setStats(DEFAULT_STATS));
      getCurrentUser().then(setCurrentUserState).catch(() => setCurrentUserState(null));
      getDailyStudyGoal().then((goal) => {
        setDailyGoal(goal);
        setDailyGoalDraft(String(goal));
      }).catch(() => {});
    }, [])
  );

  const showComingSoon = (title: string) => {
    Alert.alert(title, "This will be connected when the account system is ready.");
  };

  const confirmSignOut = () => {
    setSignOutModalVisible(true);
  };

  const signOut = async () => {
    await clearCurrentUser();
    setCurrentUserState(null);
    setSignOutModalVisible(false);
  };

  const openDailyGoalModal = () => {
    setDailyGoalDraft(String(dailyGoal));
    setDailyGoalModalVisible(true);
  };

  const saveDailyGoal = async () => {
    const parsed = Number.parseInt(dailyGoalDraft.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 200) {
      Alert.alert(t("dailyGoalTitle"), t("dailyGoalInvalid"));
      return;
    }
    await updateDailyStudyGoal(parsed);
    setDailyGoal(parsed);
    setDailyGoalModalVisible(false);
  };

  const selectLanguage = async (nextLanguage: SystemLanguage) => {
    await setLanguage(nextLanguage);
    setLanguageModalVisible(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={34} color="#6fbd8a" />
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>
            {currentUser?.display_name || currentUser?.email || t("guestLearner")}
          </Text>
          <Text style={styles.profileSubtitle}>
            {isSignedIn ? currentUser?.email : t("signInToSync")}
          </Text>
        </View>
      </View>

      {!isSignedIn && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("AccountAuth")}
          activeOpacity={0.86}
        >
          <Ionicons name="log-in-outline" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>{t("signIn")}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.deckCount}</Text>
          <Text style={styles.statLabel}>{t("decks")}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.cardCount}</Text>
          <Text style={styles.statLabel}>{t("cardsCount")}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.studiedToday}</Text>
          <Text style={styles.statLabel}>{t("today")}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("learningPreferences")}</Text>
        <ProfileRow
          icon="calendar-outline"
          label={t("dailyStudyGoal")}
          value={`${dailyGoal} ${t("cardsCount").toLowerCase()}`}
          onPress={openDailyGoalModal}
        />
        <ProfileRow
          icon="language-outline"
          label={t("systemLanguage")}
          value={systemLanguageLabel(language)}
          onPress={() => setLanguageModalVisible(true)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("security")}</Text>
        <ProfileRow
          icon={isSignedIn ? "log-out-outline" : "log-in-outline"}
          label={isSignedIn ? t("signOut") : t("signIn")}
          value={isSignedIn ? t("currentAccount") : t("localGuestMode")}
          onPress={() => isSignedIn ? confirmSignOut() : navigation.navigate("AccountAuth")}
        />
        <ProfileRow
          icon="key-outline"
          label={t("changePassword")}
          value={t("account")}
          onPress={() => isSignedIn ? navigation.navigate("ChangePassword") : navigation.navigate("AccountAuth")}
        />
        <ProfileRow
          icon="trash-outline"
          label={t("deleteAccount")}
          value={t("protected")}
          danger
          onPress={() =>
            Alert.alert(
              t("deleteAccount"),
              t("deleteAccountPendingText")
            )
          }
        />
      </View>

      <Modal
        visible={signOutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSignOutModalVisible(false)}>
          <Pressable style={styles.confirmModal} onPress={(event) => event.stopPropagation()}>
            <View style={styles.confirmIcon}>
              <Ionicons name="log-out-outline" size={28} color="#6fbd8a" />
            </View>
            <Text style={styles.confirmTitle}>{t("signOut")}</Text>
            <Text style={styles.confirmText}>{t("signOutQuestion")}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setSignOutModalVisible(false)}
                activeOpacity={0.82}
              >
                <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.okButton} onPress={signOut} activeOpacity={0.86}>
                <Text style={styles.okButtonText}>{t("ok")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={dailyGoalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDailyGoalModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDailyGoalModalVisible(false)}>
          <Pressable style={styles.confirmModal} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.confirmTitle}>{t("dailyGoalTitle")}</Text>
            <Text style={styles.confirmText}>{t("dailyGoalHint")}</Text>
            <TextInput
              style={styles.numberInput}
              value={dailyGoalDraft}
              onChangeText={(text) => setDailyGoalDraft(text.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="1-200"
              maxLength={3}
              autoFocus
            />
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDailyGoalModalVisible(false)}
                activeOpacity={0.82}
              >
                <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.okButton} onPress={saveDailyGoal} activeOpacity={0.86}>
                <Text style={styles.okButtonText}>{t("save")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setLanguageModalVisible(false)}>
          <Pressable style={styles.languageModal} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.confirmTitle}>{t("systemLanguageTitle")}</Text>
            <ScrollView style={styles.languageList}>
              {SYSTEM_LANGUAGE_OPTIONS.map((option) => {
                const selected = option === language;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.languageOption, selected && styles.languageOptionActive]}
                    onPress={() => selectLanguage(option)}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.languageOptionText, selected && styles.languageOptionTextActive]}>
                      {systemLanguageLabel(option)}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color="#6fbd8a" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.78}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={19} color={danger ? "#8f9f86" : "#6fbd8a"} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      <View style={styles.rowValueWrap}>
        <Text style={styles.rowValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={17} color="#a9c4b1" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f7f2" },
  content: { padding: 16, paddingBottom: 96 },
  profileHeader: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#edf6ef",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  profileCopy: { flex: 1 },
  profileName: { fontSize: 20, color: "#1a1a2e", fontWeight: "800" },
  profileSubtitle: { fontSize: 13, color: "#637083", fontWeight: "600", marginTop: 4 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#6fbd8a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 14 },
  statCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e2dc",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 22, color: "#1a1a2e", fontWeight: "800" },
  statLabel: { color: "#637083", fontSize: 12, fontWeight: "700", marginTop: 4 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, color: "#1a1a2e", fontWeight: "800", marginBottom: 8 },
  row: {
    minHeight: 56,
    borderTopWidth: 1,
    borderTopColor: "#e7eee9",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#edf6ef",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: { backgroundColor: "#f3f8f4" },
  rowLabel: { flex: 1, fontSize: 15, color: "#1a1a2e", fontWeight: "700" },
  rowLabelDanger: { color: "#8f9f86" },
  rowValueWrap: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  rowValue: { fontSize: 13, color: "#637083", fontWeight: "700", textAlign: "right" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,0.36)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  confirmModal: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 22,
    alignItems: "center",
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#edf6ef",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmTitle: { color: "#1a1a2e", fontSize: 21, fontWeight: "800", textAlign: "center" },
  confirmText: {
    color: "#637083",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },
  confirmActions: { width: "100%", flexDirection: "row", gap: 10, marginTop: 18 },
  numberInput: {
    width: "100%",
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e6dc",
    backgroundColor: "#f7fbf8",
    color: "#1a1a2e",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
  },
  languageModal: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "78%",
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 18,
  },
  languageList: { marginTop: 14 },
  languageOption: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e6dc",
    backgroundColor: "#f7fbf8",
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  languageOptionActive: { backgroundColor: "#edf6ef", borderColor: "#6fbd8a" },
  languageOptionText: { color: "#1a1a2e", fontSize: 15, fontWeight: "700" },
  languageOptionTextActive: { color: "#6fbd8a" },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#f7fbf8",
    borderWidth: 1,
    borderColor: "#d8e6dc",
    alignItems: "center",
    justifyContent: "center",
  },
  okButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#6fbd8a",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: { color: "#637083", fontSize: 15, fontWeight: "800" },
  okButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
