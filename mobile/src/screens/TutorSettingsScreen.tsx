import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  DEFAULT_TUTOR_SETTINGS,
  getTutorSettings,
  TutorSettings,
  updateTutorSetting,
} from "../db/database";
import { useSystemLanguage } from "../i18n";

type SettingKey = keyof TutorSettings;

const VOCABULARY_LEVELS: TutorSettings["vocabulary_level"][] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "All Levels",
];

const KEY_POINT_MODES: TutorSettings["key_points_mode"][] = [
  "Balanced",
  "Vocabulary",
  "Practical Expressions",
  "Grammar",
];

const AI_DECIDE_DETAIL: TutorSettings["ai_decide_detail"][] = ["Minimal", "Balanced", "Detailed"];

const SENTENCE_HANDLING: TutorSettings["ai_decide_sentence_handling"][] = [
  "Let AI choose",
  "Prefer whole sentence",
  "Prefer key points",
];

const SECTION_ICON_COLORS = {
  reply: "#6fbd8a",
  keyPoints: "#6fbd8a",
  decide: "#8fa678",
} as const;

export default function TutorSettingsScreen() {
  const { t } = useSystemLanguage();
  const [settings, setSettings] = useState<TutorSettings>(DEFAULT_TUTOR_SETTINGS);
  const [picker, setPicker] = useState<{
    label: string;
    key: SettingKey;
    options: any[];
  } | null>(null);
  const [maxCardsModalVisible, setMaxCardsModalVisible] = useState(false);
  const [maxCardsDraft, setMaxCardsDraft] = useState(String(DEFAULT_TUTOR_SETTINGS.key_points_max_cards));

  useEffect(() => {
    getTutorSettings().then(setSettings).catch(() => {});
  }, []);

  const saveSetting = async <K extends SettingKey>(key: K, value: TutorSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await updateTutorSetting(key, value);
  };

  const tutorOptionLabel = (option: string) => {
    switch (option) {
      case "Beginner":
        return t("optionBeginner");
      case "Intermediate":
        return t("optionIntermediate");
      case "Advanced":
        return t("optionAdvanced");
      case "All Levels":
        return t("optionAllLevels");
      case "Balanced":
        return t("optionBalanced");
      case "Vocabulary":
        return t("vocabulary");
      case "Practical Expressions":
        return t("optionPracticalExpressions");
      case "Grammar":
        return t("optionGrammar");
      case "Minimal":
        return t("optionMinimal");
      case "Detailed":
        return t("optionDetailed");
      case "Let AI choose":
        return t("optionLetAiChoose");
      case "Prefer whole sentence":
        return t("optionPreferWholeSentence");
      case "Prefer key points":
        return t("optionPreferKeyPoints");
      default:
        return option;
    }
  };

  const renderSwitch = (
    label: string,
    description: string | null,
    key: Extract<SettingKey, "reply_translation" | "reply_explanation" | "reply_usage_notes" | "reply_vocabulary" | "ai_decide_skip_obvious">
  ) => (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch
        value={Boolean(settings[key])}
        onValueChange={(value) => saveSetting(key, value as any)}
        trackColor={{ false: "#d8e2dc", true: "#d8eadc" }}
        thumbColor={settings[key] ? "#6fbd8a" : "#f4f4f5"}
      />
    </View>
  );

  const renderOptions = <K extends SettingKey>(
    label: string,
    key: K,
    options: TutorSettings[K][]
  ) => (
    <View style={styles.optionBlock}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const selected = settings[key] === option;
          return (
            <TouchableOpacity
              key={String(option)}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => saveSetting(key, option)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{tutorOptionLabel(String(option))}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderPickerRow = <K extends SettingKey>(
    label: string,
    key: K,
    options: TutorSettings[K][]
  ) => (
    <TouchableOpacity style={styles.pickerRow} onPress={() => setPicker({ label, key, options })}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.pickerValueWrap}>
        <Text style={styles.pickerValue}>{tutorOptionLabel(String(settings[key]))}</Text>
        <Ionicons name="chevron-down" size={18} color="#6fbd8a" />
      </View>
    </TouchableOpacity>
  );

  const openMaxCardsModal = () => {
    setMaxCardsDraft(String(settings.key_points_max_cards));
    setMaxCardsModalVisible(true);
  };

  const saveMaxCards = async () => {
    const parsed = Number.parseInt(maxCardsDraft.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
      Alert.alert(t("maxCards"), t("maxCardsInvalid20"));
      return;
    }
    await saveSetting("key_points_max_cards", parsed);
    setMaxCardsModalVisible(false);
  };

  const renderSectionTitle = (
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    tone: "reply" | "keyPoints" | "decide"
  ) => (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionTitleIcon, styles[`${tone}Icon`]]}>
        <Ionicons name={icon} size={17} color={SECTION_ICON_COLORS[tone]} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const selectPickerValue = async (value: any) => {
    if (!picker) return;
    await saveSetting(picker.key as any, value);
    setPicker(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>{t("aiTutorSettings")}</Text>

      <View style={styles.section}>
        {renderSectionTitle(t("aiReplyFormat"), "chatbubble-ellipses-outline", "reply")}
        {renderSwitch(t("translation"), t("translationDesc"), "reply_translation")}
        {renderSwitch(t("explanation"), t("explanationDesc"), "reply_explanation")}
        {renderSwitch(t("usageNotes"), t("usageNotesDesc"), "reply_usage_notes")}
        {renderSwitch(t("vocabulary"), t("vocabularyDesc"), "reply_vocabulary")}
        {settings.reply_vocabulary &&
          renderPickerRow(t("vocabularyLevel"), "vocabulary_level", VOCABULARY_LEVELS)}
      </View>

      <View style={styles.section}>
        {renderSectionTitle(t("flashcardKeyPoints"), "sparkles-outline", "keyPoints")}
        {renderPickerRow(t("extractionMode"), "key_points_mode", KEY_POINT_MODES)}
        <TouchableOpacity style={styles.pickerRow} onPress={openMaxCardsModal}>
          <Text style={styles.settingLabel}>{t("maxCards")}</Text>
          <View style={styles.pickerValueWrap}>
            <Text style={styles.pickerValue}>{settings.key_points_max_cards}</Text>
            <Ionicons name="create-outline" size={18} color="#6fbd8a" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        {renderSectionTitle(t("aiDecide"), "compass-outline", "decide")}
        {renderPickerRow(t("detailLevel"), "ai_decide_detail", AI_DECIDE_DETAIL)}
        {renderPickerRow(t("sentenceHandling"), "ai_decide_sentence_handling", SENTENCE_HANDLING)}
        {renderSwitch(t("skipObviousItems"), t("skipObviousDesc"), "ai_decide_skip_obvious")}
      </View>

      <Modal visible={Boolean(picker)} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{picker?.label}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPicker(null)}>
                <Ionicons name="close" size={20} color="#6fbd8a" />
              </TouchableOpacity>
            </View>
            {picker?.options.map((option) => {
              const selected = settings[picker.key] === option;
              return (
                <TouchableOpacity
                  key={String(option)}
                  style={[styles.modalOption, selected && styles.modalOptionActive]}
                  onPress={() => selectPickerValue(option)}
                >
                  <Text style={[styles.modalOptionText, selected && styles.modalOptionTextActive]}>
                    {tutorOptionLabel(String(option))}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color="#6fbd8a" />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={maxCardsModalVisible} transparent animationType="fade" onRequestClose={() => setMaxCardsModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMaxCardsModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("maxCards")}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setMaxCardsModalVisible(false)}>
                <Ionicons name="close" size={20} color="#6fbd8a" />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHint}>{t("maxCardsHint")}</Text>
            <TextInput
              style={styles.numberInput}
              value={maxCardsDraft}
              onChangeText={(text) => setMaxCardsDraft(text.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="1-20"
              maxLength={2}
              autoFocus
            />
            <TouchableOpacity style={styles.saveModalButton} onPress={saveMaxCards} activeOpacity={0.86}>
              <Text style={styles.saveModalButtonText}>{t("save")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f7f2" },
  content: { padding: 16, paddingBottom: 32 },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a2e",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 18,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 14,
    marginBottom: 14,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sectionTitleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  replyIcon: { backgroundColor: "#edf6ef" },
  keyPointsIcon: { backgroundColor: "#eaf8f1" },
  decideIcon: { backgroundColor: "#f1f7e9" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a2e" },
  switchRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e7eee9",
    paddingVertical: 10,
    gap: 12,
  },
  settingLabel: { fontSize: 15, color: "#1a1a2e", fontWeight: "600" },
  settingDescription: { fontSize: 12, color: "#637083", lineHeight: 17, marginTop: 3 },
  optionBlock: {
    borderTopWidth: 1,
    borderTopColor: "#e7eee9",
    paddingTop: 12,
    paddingBottom: 4,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8e6dc",
    backgroundColor: "#f7fbf8",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#edf6ef", borderColor: "#6fbd8a" },
  chipText: { color: "#1a1a2e", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#6fbd8a" },
  pickerRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e7eee9",
    paddingVertical: 10,
    gap: 12,
  },
  pickerValueWrap: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  pickerValue: { color: "#637083", fontSize: 14, fontWeight: "600", textAlign: "right" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,0.36)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d8e2dc",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a2e" },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#edf6ef",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e6dc",
    backgroundColor: "#f7fbf8",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  modalOptionActive: { backgroundColor: "#edf6ef", borderColor: "#6fbd8a" },
  modalOptionText: { color: "#1a1a2e", fontSize: 15, fontWeight: "600" },
  modalOptionTextActive: { color: "#6fbd8a" },
  inputHint: { color: "#637083", fontSize: 13, lineHeight: 18, marginBottom: 10 },
  numberInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#d8e6dc",
    backgroundColor: "#f7fbf8",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  saveModalButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#6fbd8a",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  saveModalButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
