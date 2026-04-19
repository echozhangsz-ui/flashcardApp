import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { deleteDeck, getDeckById, updateDeckCardsStudyPerDay, updateDeckName } from "../db/database";
import { useSystemLanguage } from "../i18n";
import { RootStackParamList } from "../../App";

type DeckSettingsRoute = RouteProp<RootStackParamList, "DeckSettings">;
type Nav = StackNavigationProp<RootStackParamList, "DeckSettings">;

export default function DeckSettingsScreen() {
  const route = useRoute<DeckSettingsRoute>();
  const navigation = useNavigation<Nav>();
  const { t } = useSystemLanguage();
  const { deckId, deckName } = route.params;
  const [currentDeckName, setCurrentDeckName] = useState(deckName);
  const [cardsStudyPerDay, setCardsStudyPerDay] = useState(20);
  const [inputVisible, setInputVisible] = useState(false);
  const [draftValue, setDraftValue] = useState("20");
  const [renameVisible, setRenameVisible] = useState(false);
  const [draftDeckName, setDraftDeckName] = useState(deckName);

  const loadSettings = useCallback(async () => {
    const deck = await getDeckById(deckId);
    const value = deck?.cards_study_per_day ?? 20;
    const name = deck?.name ?? deckName;
    setCurrentDeckName(name);
    setDraftDeckName(name);
    setCardsStudyPerDay(value);
    setDraftValue(String(value));
  }, [deckId, deckName]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const openNumberInput = () => {
    setDraftValue(String(cardsStudyPerDay));

    if (Platform.OS === "ios") {
      Alert.prompt(
        t("cardsStudyPerDay"),
        t("enterNumber"),
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("save"),
            onPress: (value?: string) => saveCardsStudyPerDay(value ?? ""),
          },
        ],
        "plain-text",
        String(cardsStudyPerDay),
        "number-pad"
      );
      return;
    }

    setInputVisible(true);
  };

  const saveCardsStudyPerDay = async (value: string) => {
    const nextValue = Number.parseInt(value, 10);
    if (!Number.isFinite(nextValue) || nextValue < 1 || nextValue > 999) {
      Alert.alert(t("dailyGoalTitle"), t("maxCardsInvalid999"));
      return;
    }

    await updateDeckCardsStudyPerDay(deckId, nextValue);
    setCardsStudyPerDay(nextValue);
    setDraftValue(String(nextValue));
    setInputVisible(false);
  };

  const openRenameDialog = () => {
    setDraftDeckName(currentDeckName);
    setRenameVisible(true);
  };

  const saveDeckName = async () => {
    const nextName = draftDeckName.trim();
    if (!nextName) {
      Alert.alert(t("changeDeckName"), t("deckNameRequired"));
      return;
    }

    await updateDeckName(deckId, nextName);
    setCurrentDeckName(nextName);
    setDraftDeckName(nextName);
    setRenameVisible(false);
  };

  const confirmDeleteDeck = () => {
    Alert.alert(
      t("deleteDeck"),
      t("deleteDeckQuestion", { name: currentDeckName }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            await deleteDeck(deckId);
            navigation.popToTop();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>{t("setting")}</Text>
      <TouchableOpacity style={styles.settingRow} onPress={openNumberInput} activeOpacity={0.78}>
        <Text style={styles.settingLabel}>{t("cardsStudyPerDay")}</Text>
        <View style={styles.settingValueWrap}>
          <Text style={styles.settingValue}>{cardsStudyPerDay}</Text>
          <Ionicons name="chevron-forward" size={20} color="#6fbd8a" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingRow} onPress={openRenameDialog} activeOpacity={0.78}>
        <Text style={styles.settingLabel}>{t("changeDeckName")}</Text>
        <View style={styles.settingValueWrap}>
          <Ionicons name="chevron-forward" size={20} color="#6fbd8a" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingRow} onPress={confirmDeleteDeck} activeOpacity={0.78}>
        <Text style={[styles.settingLabel, styles.deleteLabel]}>{t("deleteDeck")}</Text>
        <View style={styles.settingValueWrap}>
          <Ionicons name="chevron-forward" size={20} color="#8f9f86" />
        </View>
      </TouchableOpacity>

      {inputVisible && (
        <View style={styles.inputPanel}>
          <TextInput
            style={styles.numberInput}
            value={draftValue}
            onChangeText={setDraftValue}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
          />
          <View style={styles.inputActions}>
            <TouchableOpacity style={styles.inputCancel} onPress={() => setInputVisible(false)}>
              <Text style={styles.inputCancelText}>{t("cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inputSave} onPress={() => saveCardsStudyPerDay(draftValue)}>
              <Text style={styles.inputSaveText}>{t("save")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setRenameVisible(false)}>
          <TouchableOpacity style={styles.renameBox} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.renameTitle}>{t("changeDeckName")}</Text>
            <TextInput
              style={styles.renameInput}
              value={draftDeckName}
              onChangeText={setDraftDeckName}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.inputActions}>
              <TouchableOpacity style={styles.inputCancel} onPress={() => setRenameVisible(false)}>
                <Text style={styles.inputCancelText}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inputSave} onPress={saveDeckName}>
                <Text style={styles.inputSaveText}>{t("save")}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f7f2", padding: 16 },
  pageTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1a1a2e",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 18,
  },
  settingRow: {
    minHeight: 58,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#d8e2dc",
    marginBottom: 10,
  },
  settingLabel: { flex: 1, fontSize: 16, color: "#1a1a2e", fontWeight: "700" },
  deleteLabel: { color: "#8f9f86" },
  settingValueWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingValue: { fontSize: 16, color: "#637083", fontWeight: "800" },
  inputPanel: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 14,
    marginTop: 12,
  },
  numberInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cfe0d4",
    paddingHorizontal: 12,
    fontSize: 18,
    color: "#1a1a2e",
    fontWeight: "800",
  },
  inputActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  inputCancel: { paddingHorizontal: 14, paddingVertical: 10 },
  inputCancelText: { color: "#637083", fontWeight: "800" },
  inputSave: {
    backgroundColor: "#6fbd8a",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inputSaveText: { color: "#fff", fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,0.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  renameBox: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d8e2dc",
  },
  renameTitle: { fontSize: 18, fontWeight: "900", color: "#1a1a2e", marginBottom: 12 },
  renameInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cfe0d4",
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#1a1a2e",
    fontWeight: "800",
  },
});
