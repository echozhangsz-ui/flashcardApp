import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Animated, Modal, ScrollView, Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { API_BASE, AnswerLanguage, generateFlashcards, recognizeImageText } from "../api/client";
import {
  createDeck,
  DEFAULT_TUTOR_SETTINGS,
  getAllDecks,
  getTutorSettings,
  insertCards,
  TutorSettings,
} from "../db/database";
import { useSystemLanguage } from "../i18n";
import { RootStackParamList } from "../../App";

type Nav = StackNavigationProp<RootStackParamList, "Chat">;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  flashcards?: { front: string; back: string }[];
  sourceUserText?: string;
}

interface DeckOption {
  id: number;
  name: string;
  created_at: number;
  card_count: number;
}

const ANSWER_LANGUAGE_OPTIONS: AnswerLanguage[] = [
  "Chinese",
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Japanese",
  "Korean",
  "Arabic",
  "Russian",
  "Hindi",
  "Italian",
  "Bilingual",
];

export default function ChatScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useSystemLanguage();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content: t("aiTutorGreeting"),
    },
  ]);
  const [input, setInput] = useState("");
  const [answerLanguage, setAnswerLanguage] = useState<AnswerLanguage>("Chinese");
  const [tutorSettings, setTutorSettings] = useState<TutorSettings>(DEFAULT_TUTOR_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [isRecognizingImage, setIsRecognizingImage] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [deckPickerVisible, setDeckPickerVisible] = useState(false);
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [newDeckName, setNewDeckName] = useState("");
  const [pendingCards, setPendingCards] = useState<{ front: string; back: string }[]>([]);
  const [pendingSourceText, setPendingSourceText] = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const voiceBusyRef = useRef(false);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === "0"
          ? { ...message, content: t("aiTutorGreeting") }
          : message
      )
    );
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      getTutorSettings().then(setTutorSettings).catch(() => {});
    }, [])
  );

  useEffect(() => {
    return () => {
      const activeRecording = recordingRef.current;
      if (activeRecording) {
        activeRecording.stopAndUnloadAsync().catch(() => {});
      }
      Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    };
  }, []);

  // doSend contains the actual API logic — no loading guard so voice can call it freely
  const doSend = async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    setMessages((prev) => {
      const updatedMessages = [...prev, userMsg];
      // kick off the API call with the updated list
      (async () => {
        setLoading(true);
        try {
          const currentTutorSettings = await getTutorSettings();
          setTutorSettings(currentTutorSettings);
          const res = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: updatedMessages
                .filter((m) => m.id !== "0")
                .map((m) => ({ role: m.role, content: m.content })),
              answer_language: answerLanguage,
              tutor_settings: currentTutorSettings,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail ?? "Request failed");
          }
          const data = await res.json();
          setMessages((p) => [
            ...p,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: data.reply,
              flashcards: data.flashcards ?? undefined,
              sourceUserText: text.trim(),
            },
          ]);
        } catch (e: any) {
          setMessages((p) => [
            ...p,
            { id: (Date.now() + 1).toString(), role: "assistant", content: `Error: ${e.message}` },
          ]);
        } finally {
          setLoading(false);
        }
      })();
      return updatedMessages;
    });
    setInput("");
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    await doSend(text);
  };

  const startRecording = async () => {
    if (voiceBusyRef.current || loading || isProcessingVoice) return;
    voiceBusyRef.current = true;
    try {
      const existing = recordingRef.current;
      if (existing) {
        try { await existing.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
        setRecording(null);
      }
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Microphone permission required");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = rec;
      setRecording(rec);
      setIsRecording(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } catch (e: any) {
      Alert.alert("Recording failed", e.message);
    } finally {
      voiceBusyRef.current = false;
    }
  };

  const stopRecording = async () => {
    if (voiceBusyRef.current) return;
    const rec = recordingRef.current;
    if (!rec) return;
    voiceBusyRef.current = true;
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    setIsRecording(false);
    recordingRef.current = null;
    setRecording(null);

    try {
      const status = await rec.getStatusAsync().catch(() => null);
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = rec.getURI();

      if (!uri) {
        Alert.alert("Speech recognition failed", "Recording file was not created.");
        return;
      }
      if ((status as any)?.durationMillis < 500) {
        Alert.alert("Recording too short", "Please speak a little longer, then tap stop.");
        return;
      }

      setIsProcessingVoice(true);
      setLoading(true);
      const formData = new FormData();
      const ext = uri.split(".").pop() ?? "m4a";
      const mimeMap: Record<string, string> = { m4a: "audio/m4a", caf: "audio/x-caf", wav: "audio/wav", "3gp": "audio/3gpp" };
      const mime = mimeMap[ext] ?? "audio/m4a";
      formData.append("file", { uri, name: `audio.${ext}`, type: mime } as any);

      const res = await fetch(`${API_BASE}/transcribe`, { method: "POST", body: formData });
      setLoading(false);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.detail ?? `Transcription failed (${res.status})`;
        if (!msg.includes("audio_too_short") && !msg.includes("too short")) {
          Alert.alert("Speech recognition failed", msg);
        }
        return;
      }

      const { text } = await res.json();
      if (text?.trim()) {
        await doSend(text.trim()); // bypass loading guard — mic flow owns its state
      } else {
        Alert.alert("No speech detected", "I couldn't hear any clear speech. Please try again.");
      }
    } catch (e: any) {
      if (!e.message?.includes("audio_too_short") && !e.message?.includes("too short")) {
        Alert.alert("Speech recognition failed", e.message);
      }
    } finally {
      setLoading(false);
      setIsProcessingVoice(false);
      voiceBusyRef.current = false;
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
      return;
    }
    await startRecording();
  };

  const handleSaveFlashcards = async (cards: { front: string; back: string }[]) => {
    const defaultName = `AI Generated ${new Date().toLocaleDateString("en-US")}`;

    Alert.alert(
      "Save Flashcards",
      `Save ${cards.length} card(s) to new deck "${defaultName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async () => {
            const deckId = await createDeck(defaultName);
            await insertCards(deckId, cards.map((c) => ({ ...c, front_lang: "fr", back_lang: "zh" })));
            Alert.alert("Saved", `${cards.length} card(s) added to your library`, [
              { text: "Study Now", onPress: () => navigation.navigate("HomeTab" as any, { screen: "Study", params: { deckId, deckName: defaultName } }) },
              { text: "Keep Chatting" },
            ]);
          },
        },
      ]
    );
  };

  const openDeckPicker = async (cards: { front: string; back: string }[], sourceText: string) => {
    const allDecks = await getAllDecks();
    setDecks(allDecks);
    setPendingCards(cards);
    setPendingSourceText(sourceText);
    setNewDeckName("");
    setDeckPickerVisible(true);
  };

  const saveCardsToDeck = async (deckId: number, deckName: string, cards: { front: string; back: string }[]) => {
    await insertCards(deckId, cards.map((c) => ({ ...c, front_lang: "fr", back_lang: "zh" })));
    setDeckPickerVisible(false);
    setPendingCards([]);
    setPendingSourceText("");
    Alert.alert("Saved", `${cards.length} card(s) added to "${deckName}"`, [
      { text: "Study Now", onPress: () => navigation.navigate("HomeTab" as any, { screen: "Study", params: { deckId, deckName } }) },
      { text: "Keep Chatting" },
    ]);
  };

  const handleCreateDeckAndSave = async () => {
    const deckName = newDeckName.trim();
    if (!deckName) {
      Alert.alert("Notice", "Please enter a deck name");
      return;
    }
    const deckId = await createDeck(deckName);
    await saveCardsToDeck(deckId, deckName, pendingCards);
  };

  const handleGenerateFlashcards = async (message: Message, mode: "sentence" | "keywords" | "auto") => {
    const sourceText = message.sourceUserText?.trim();
    if (!sourceText) {
      Alert.alert("Notice", "I couldn't find the original text for this reply.");
      return;
    }

    try {
      setIsGeneratingFlashcards(true);
      const currentTutorSettings = await getTutorSettings();
      setTutorSettings(currentTutorSettings);
      const cards = await generateFlashcards(sourceText, message.content, mode, answerLanguage, currentTutorSettings);
      if (!cards.length) {
        Alert.alert("Notice", "No flashcards were generated for this reply.");
        return;
      }
      await openDeckPicker(cards, sourceText);
    } catch (e: any) {
      Alert.alert("Flashcard generation failed", e.message ?? "Please try again.");
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const promptGenerateMode = (message: Message) => {
    Alert.alert(
      "Generate Flashcards",
      "Choose how this reply should become flashcards.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save Whole Sentence", onPress: () => handleGenerateFlashcards(message, "sentence") },
        { text: "Extract Key Points", onPress: () => handleGenerateFlashcards(message, "keywords") },
        { text: "AI Decide", onPress: () => handleGenerateFlashcards(message, "auto") },
      ]
    );
  };

  const handleImagePicked = async (asset: { uri: string; fileName?: string | null; mimeType?: string | null }) => {
    try {
      setIsRecognizingImage(true);
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      const fileName = `image-${Date.now()}.jpg`;
      const mimeType = "image/jpeg";
      const recognizedText = await recognizeImageText(manipulated.uri, fileName, mimeType);
      if (!recognizedText.trim()) {
        Alert.alert("No text found", "I couldn't find readable text in that image.");
        return;
      }
      setInput(recognizedText.trim());
    } catch (e: any) {
      Alert.alert("Image recognition failed", e.message ?? "Please try another image.");
    } finally {
      setIsRecognizingImage(false);
    }
  };

  const openCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission required", "Please allow camera access to capture text.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.45,
    });
    if (!result.canceled && result.assets[0]) {
      await handleImagePicked(result.assets[0]);
    }
  };

  const openPhotoLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo permission required", "Please allow photo access to choose an image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.45,
    });
    if (!result.canceled && result.assets[0]) {
      await handleImagePicked(result.assets[0]);
    }
  };

  const promptImageSource = () => {
    if (loading || isProcessingVoice || isRecognizingImage) return;
    Alert.alert(
      "Add from Image",
      "Choose how you want to import text.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: openCamera },
        { text: "Choose from Photos", onPress: openPhotoLibrary },
      ]
    );
  };

  const promptAnswerLanguage = () => {
    setLanguagePickerVisible(true);
  };

  const selectAnswerLanguage = (language: AnswerLanguage) => {
    setAnswerLanguage(language);
    setLanguagePickerVisible(false);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
        {!isUser && (
          <View style={styles.avatarWrap}>
            <Ionicons name="sparkles" size={18} color="#6fbd8a" />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.content}</Text>
          {item.id === "0" && (
            <TouchableOpacity style={styles.languagePickerBtn} onPress={promptAnswerLanguage}>
              <Text style={styles.languagePickerLabel}>{t("answerLanguage")}</Text>
              <View style={styles.languagePickerValueRow}>
                <Text style={styles.languagePickerValue}>{answerLanguage}</Text>
                <Ionicons name="chevron-down" size={16} color="#6fbd8a" />
              </View>
            </TouchableOpacity>
          )}
          {item.flashcards && item.flashcards.length > 0 && (
            <View style={styles.flashcardPreview}>
              <Text style={styles.flashcardPreviewTitle}>
                {item.flashcards.length} flashcard{item.flashcards.length > 1 ? "s" : ""} ready to save:
              </Text>
              {item.flashcards.slice(0, 3).map((c, i) => (
                <Text key={i} style={styles.flashcardPreviewItem}>• {c.front} → {c.back.split("\n")[0]}</Text>
              ))}
              {item.flashcards.length > 3 && (
                <Text style={styles.flashcardPreviewItem}>…and {item.flashcards.length - 3} more</Text>
              )}
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => handleSaveFlashcards(item.flashcards!)}
              >
                <Text style={styles.saveBtnText}>Save to Library →</Text>
              </TouchableOpacity>
            </View>
          )}
          {!item.flashcards?.length && !isUser && item.sourceUserText && (
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={() => promptGenerateMode(item)}
              disabled={isGeneratingFlashcards}
            >
              <Ionicons name="sparkles-outline" size={16} color="#6fbd8a" style={{ marginRight: 6 }} />
              <Text style={styles.generateBtnText}>
                {isGeneratingFlashcards ? "Generating..." : "Generate Flashcards"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {(loading || isRecognizingImage) && (
          <View style={styles.typingRow}>
            <Text style={styles.typingText}>{isRecognizingImage ? "Reading image" : "Thinking"}</Text>
            <ActivityIndicator size="small" color="#6fbd8a" style={{ marginLeft: 6 }} />
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your text..."
            value={input}
            onChangeText={setInput}
            multiline
            editable={!isRecognizingImage}
            onSubmitEditing={() => sendMessage(input)}
          />

          {/* Voice button */}
          <View>
            <TouchableOpacity
              style={[styles.iconBtn, (loading || isRecognizingImage) && styles.iconBtnDisabled]}
              onPress={promptImageSource}
              disabled={loading || isProcessingVoice || isRecognizingImage}
            >
              <Ionicons name="camera-outline" size={22} color="#555" />
            </TouchableOpacity>
          </View>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.voiceBtn, isRecording && styles.voiceBtnActive]}
              onPress={toggleRecording}
              disabled={loading || isProcessingVoice || isRecognizingImage}
            >
              <Ionicons
                name={isRecording ? "stop-circle" : "mic-outline"}
                size={22}
                color={isRecording ? "#8f9f86" : "#555"}
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Send button */}
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading || isRecognizingImage) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading || isRecognizingImage}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={languagePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguagePickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setLanguagePickerVisible(false)}>
          <Pressable style={styles.languageModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.languageModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{t("answerLanguage")}</Text>
                <Text style={styles.modalSubtitle}>
                  {t("answerLanguageDesc")}
                </Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setLanguagePickerVisible(false)}>
                <Ionicons name="close" size={20} color="#6fbd8a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.languageList} contentContainerStyle={{ paddingBottom: 4 }}>
              {ANSWER_LANGUAGE_OPTIONS.map((language) => {
                const selected = language === answerLanguage;
                return (
                  <TouchableOpacity
                    key={language}
                    style={[styles.languageOption, selected && styles.languageOptionActive]}
                    onPress={() => selectAnswerLanguage(language)}
                  >
                    <Text style={[styles.languageOptionText, selected && styles.languageOptionTextActive]}>
                      {language}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color="#6fbd8a" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={deckPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeckPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save Flashcards</Text>
            <Text style={styles.modalSubtitle} numberOfLines={2}>
              Source: {pendingSourceText || "AI reply"}
            </Text>

            <Text style={styles.modalSectionTitle}>Choose a deck</Text>
            <ScrollView style={styles.deckList} contentContainerStyle={{ paddingBottom: 4 }}>
              {decks.length > 0 ? (
                decks.map((deck) => (
                  <TouchableOpacity
                    key={deck.id}
                    style={styles.deckOption}
                    onPress={() => saveCardsToDeck(deck.id, deck.name, pendingCards)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deckOptionName}>{deck.name}</Text>
                      <Text style={styles.deckOptionMeta}>{deck.card_count} cards</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#6fbd8a" />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyDeckText}>No decks yet. Create one below.</Text>
              )}
            </ScrollView>

            <Text style={styles.modalSectionTitle}>Or create a new deck</Text>
            <View style={styles.createDeckRow}>
              <TextInput
                style={styles.modalInput}
                placeholder="New deck name"
                value={newDeckName}
                onChangeText={setNewDeckName}
              />
              <TouchableOpacity style={styles.createDeckBtn} onPress={handleCreateDeckAndSave}>
                <Text style={styles.createDeckBtnText}>Create</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDeckPickerVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f7f2" },
  messageList: { padding: 12, paddingBottom: 8 },
  msgRow: { flexDirection: "row", marginBottom: 12, alignItems: "flex-end" },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAI: { justifyContent: "flex-start" },
  avatarWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#edf6ef", alignItems: "center", justifyContent: "center",
    marginRight: 6, marginBottom: 2,
  },
  bubble: {
    maxWidth: "78%", padding: 12, borderRadius: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  bubbleUser: { backgroundColor: "#6fbd8a", borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: "#fff", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: "#1a1a2e", lineHeight: 22 },
  bubbleTextUser: { color: "#fff" },
  languagePickerBtn: {
    marginTop: 12,
    backgroundColor: "#edf6ef",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c7dacd",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  languagePickerLabel: { fontSize: 12, color: "#6fbd8a", fontWeight: "700", marginBottom: 4 },
  languagePickerValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  languagePickerValue: { fontSize: 14, color: "#1a1a2e", fontWeight: "600" },
  flashcardPreview: {
    marginTop: 10, padding: 10, backgroundColor: "#edf6ef",
    borderRadius: 10, borderWidth: 1, borderColor: "#c7dacd",
  },
  flashcardPreviewTitle: { fontSize: 13, fontWeight: "700", color: "#6fbd8a", marginBottom: 6 },
  flashcardPreviewItem: { fontSize: 13, color: "#444", marginBottom: 3 },
  saveBtn: {
    marginTop: 8, backgroundColor: "#6fbd8a", padding: 8,
    borderRadius: 8, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  generateBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#edf6ef",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#c7dacd",
  },
  generateBtnText: { color: "#6fbd8a", fontWeight: "700", fontSize: 13 },
  typingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 4 },
  typingText: { color: "#888", fontSize: 13 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", padding: 10,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e7eee9", gap: 8,
  },
  textInput: {
    flex: 1, backgroundColor: "#f1f7f2", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    minHeight: 44, maxHeight: 180, borderWidth: 1, borderColor: "#d8e2dc",
    textAlignVertical: "top",
  },
  voiceBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#edf4ee",
    alignItems: "center", justifyContent: "center",
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#edf4ee",
    alignItems: "center", justifyContent: "center",
  },
  iconBtnDisabled: { opacity: 0.55 },
  voiceBtnActive: { backgroundColor: "#edf4ee" },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#6fbd8a", alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#6fbd8a", opacity: 0.45 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    maxHeight: "82%",
  },
  languageModalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    maxHeight: "78%",
  },
  languageModalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#edf6ef",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#1a1a2e" },
  modalSubtitle: { fontSize: 13, color: "#666", marginTop: 6, lineHeight: 18 },
  languageList: { marginTop: 16, maxHeight: 360 },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f7fbf8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#d8e6dc",
    marginBottom: 8,
  },
  languageOptionActive: { backgroundColor: "#edf6ef", borderColor: "#6fbd8a" },
  languageOptionText: { fontSize: 15, color: "#1a1a2e", fontWeight: "600" },
  languageOptionTextActive: { color: "#6fbd8a" },
  modalSectionTitle: { fontSize: 14, fontWeight: "700", color: "#555", marginTop: 18, marginBottom: 10 },
  deckList: { maxHeight: 220 },
  deckOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7fbf8",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#d8e6dc",
    marginBottom: 8,
  },
  deckOptionName: { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  deckOptionMeta: { fontSize: 12, color: "#6b7280", marginTop: 3 },
  emptyDeckText: { color: "#888", fontSize: 14, marginBottom: 8 },
  createDeckRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  modalInput: {
    flex: 1,
    backgroundColor: "#f7fbf8",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8e6dc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  createDeckBtn: {
    backgroundColor: "#6fbd8a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  createDeckBtnText: { color: "#fff", fontWeight: "700" },
  modalCancelBtn: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 10,
  },
  modalCancelText: { color: "#6b7280", fontWeight: "600" },
});
