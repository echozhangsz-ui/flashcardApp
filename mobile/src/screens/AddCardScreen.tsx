import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { createDeck, insertCard, insertCards, getCardsForDeck, getDeckById } from "../db/database";
import { AnswerLanguage, generateDeckFromNotes, parsePdf, recognizeImageText, transcribeAudio } from "../api/client";
import { useSystemLanguage } from "../i18n";
import { RootStackParamList } from "../../App";

type AddCardRoute = RouteProp<RootStackParamList, "AddCard">;
type Nav = StackNavigationProp<RootStackParamList, "AddCard">;
type ImportKind = "record" | "audio" | "photo" | "notes" | null;
type CardSide = "front" | "back";

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

const mimeForAudio = (uri: string) => {
  const ext = uri.split(".").pop()?.toLowerCase() ?? "m4a";
  const mimeMap: Record<string, string> = {
    m4a: "audio/m4a",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    caf: "audio/x-caf",
    "3gp": "audio/3gpp",
  };
  return { ext, mimeType: mimeMap[ext] ?? "audio/m4a" };
};

const formatDuration = (millis?: number | null) => {
  if (!millis) return "0:00";
  const totalSeconds = Math.max(0, Math.round(millis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export default function AddCardScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<AddCardRoute>();
  const { t } = useSystemLanguage();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const cardVoiceRecordingRef = useRef<Audio.Recording | null>(null);
  const suppressKeyboardHideRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const [newDeckName, setNewDeckName] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [frontImageUri, setFrontImageUri] = useState<string | null>(null);
  const [backImageUri, setBackImageUri] = useState<string | null>(null);
  const [frontBold, setFrontBold] = useState(false);
  const [backBold, setBackBold] = useState(false);
  const [frontUnderline, setFrontUnderline] = useState(false);
  const [backUnderline, setBackUnderline] = useState(false);
  const [activeSide, setActiveSide] = useState<CardSide>("front");
  const [isCardKeyboardActive, setIsCardKeyboardActive] = useState(false);
  const [cardVoiceRecording, setCardVoiceRecording] = useState<Audio.Recording | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [activeDeck, setActiveDeck] = useState<{ id: number; name: string } | null>(null);
  const [busyLabel, setBusyLabel] = useState("");
  const [importMenuVisible, setImportMenuVisible] = useState(false);
  const [activeImport, setActiveImport] = useState<ImportKind>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [audioFile, setAudioFile] = useState<{ uri: string; name: string; mimeType: string; durationMillis?: number | null } | null>(null);
  const [recordingScript, setRecordingScript] = useState("");
  const [scriptSource, setScriptSource] = useState("recorded lecture");
  const [scriptVisible, setScriptVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [answerLanguage, setAnswerLanguage] = useState<AnswerLanguage>("Chinese");
  const [photoNotes, setPhotoNotes] = useState("");
  const [pastedNotes, setPastedNotes] = useState("");
  const [successDeck, setSuccessDeck] = useState<{ id: number; name: string; count?: number } | null>(null);

  useEffect(() => {
    const keyboardHideSub = Keyboard.addListener("keyboardDidHide", () => {
      if (!suppressKeyboardHideRef.current) {
        setIsCardKeyboardActive(false);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    });

    return () => {
      keyboardHideSub.remove();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      cardVoiceRecordingRef.current?.stopAndUnloadAsync().catch(() => {});
      Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (route.params?.deckId) {
          const deckId = route.params.deckId;
          const deck = await getDeckById(deckId);
          setActiveDeck({ id: deckId, name: route.params.deckName ?? deck?.name ?? t("selectedDeck") });
          setCards(await getCardsForDeck(deckId));
        }
      })();
    }, [route.params?.deckId, route.params?.deckName, t])
  );

  const animateSuccess = () => {
    successAnim.setValue(0);
    Animated.spring(successAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const startWaveAnimation = () => {
    waveAnim.setValue(0);
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    ).start();
  };

  const showSuccess = (deck: { id: number; name: string; count?: number }) => {
    setSuccessDeck(deck);
    animateSuccess();
  };

  const createGeneratedDeck = async (notes: string, source: string, language: AnswerLanguage = answerLanguage) => {
    if (!notes.trim()) {
      Alert.alert(t("notice"), t("pleaseAddContentFirst"));
      return;
    }

    setBusyLabel(t("generatingFlashcards"));
    try {
      const parsed = await generateDeckFromNotes(notes.trim(), source, language);
      const deckId = await createDeck(parsed.deck_name);
      await insertCards(deckId, parsed.cards);
      setActiveDeck({ id: deckId, name: parsed.deck_name });
      setCards(await getCardsForDeck(deckId));
      setActiveImport(null);
      setImportMenuVisible(false);
      showSuccess({ id: deckId, name: parsed.deck_name, count: parsed.count });
    } catch (e: any) {
      Alert.alert(t("generationFailed"), e.message ?? t("pleaseTryAgain"));
    } finally {
      setBusyLabel("");
    }
  };

  const handleCreateDeck = async () => {
    const name = newDeckName.trim();
    if (!name) return Alert.alert(t("notice"), t("deckNameRequired"));

    setBusyLabel(t("creatingDeck"));
    try {
      const id = await createDeck(name);
      setActiveDeck({ id, name });
      setCards([]);
      setNewDeckName("");
      showSuccess({ id, name, count: 0 });
    } catch (e: any) {
      Alert.alert(t("createFailed"), e.message ?? t("pleaseTryAgain"));
    } finally {
      setBusyLabel("");
    }
  };

  const handleImportPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      setBusyLabel(t("importingPdf"));
      const parsed = await parsePdf(file.uri, file.name);
      const deckId = await createDeck(parsed.deck_name);
      await insertCards(deckId, parsed.cards);
      setActiveDeck({ id: deckId, name: parsed.deck_name });
      setCards(await getCardsForDeck(deckId));
      setImportMenuVisible(false);
      showSuccess({ id: deckId, name: parsed.deck_name, count: parsed.count });
    } catch (e: any) {
      Alert.alert(t("pdfImportFailed"), e.message ?? t("pleaseTryAgain"));
    } finally {
      setBusyLabel("");
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("microphonePermissionRequired"), t("allowMicrophoneRecord"));
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setIsRecordingPaused(false);
      setAudioFile(null);
      setRecordingScript("");
      setScriptVisible(false);
      startWaveAnimation();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } catch (e: any) {
      Alert.alert(t("recordingFailed"), e.message ?? t("pleaseTryAgain"));
    }
  };

  const pauseRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.pauseAsync();
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      waveAnim.stopAnimation();
      setIsRecordingPaused(true);
    } catch (e: any) {
      Alert.alert(t("pauseFailed"), e.message ?? t("pleaseTryAgain"));
    }
  };

  const resumeRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.startAsync();
      setIsRecordingPaused(false);
      startWaveAnimation();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } catch (e: any) {
      Alert.alert(t("resumeFailed"), e.message ?? t("pleaseTryAgain"));
    }
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    waveAnim.stopAnimation();
    waveAnim.setValue(0);
    setIsRecording(false);
    setIsRecordingPaused(false);
    recordingRef.current = null;

    try {
      const status = await recording.getStatusAsync().catch(() => null);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = recording.getURI();
      if (!uri) {
        Alert.alert(t("recordingFailed"), t("noAudioCreated"));
        return;
      }
      const { ext, mimeType } = mimeForAudio(uri);
      setAudioFile({
        uri,
        name: `lecture-${Date.now()}.${ext}`,
        mimeType,
        durationMillis: (status as any)?.durationMillis,
      });
    } catch (e: any) {
      Alert.alert(t("recordingFailed"), e.message ?? t("pleaseTryAgain"));
    }
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      const { mimeType } = mimeForAudio(file.uri);
      setAudioFile({
        uri: file.uri,
        name: file.name ?? `audio-${Date.now()}`,
        mimeType: file.mimeType ?? mimeType,
      });
    } catch (e: any) {
      Alert.alert(t("audioImportFailed"), e.message ?? t("pleaseTryAgain"));
    }
  };

  const generateFromAudio = async () => {
    if (!audioFile) {
      Alert.alert(t("notice"), t("recordOrImportAudioFirst"));
      return;
    }

    const source = activeImport === "record" ? "recorded lecture" : "audio file";
    setScriptSource(source);
    if (activeImport === "record") setActiveImport(null);
    setBusyLabel(t("readingAudio"));
    try {
      const transcript = await transcribeAudio(audioFile.uri, audioFile.name, audioFile.mimeType);
      if (!transcript.trim()) {
        Alert.alert(t("noScriptFound"), t("noClearSpeechAudio"));
        return;
      }
      setRecordingScript(transcript.trim());
      setScriptVisible(true);
    } catch (e: any) {
      Alert.alert(t("audioProcessingFailed"), e.message ?? t("pleaseTryAgain"));
    } finally {
      setBusyLabel("");
    }
  };

  const generateDeckFromRecordingScript = async () => {
    await createGeneratedDeck(recordingScript, scriptSource, answerLanguage);
    setAudioFile(null);
    setRecordingScript("");
    setScriptVisible(false);
    setScriptSource("recorded lecture");
  };

  const recognizeImage = async (asset: { uri: string }) => {
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
    );
    return recognizeImageText(manipulated.uri, `note-${Date.now()}.jpg`, "image/jpeg");
  };

  const updateActiveSideText = (text: string) => {
    if (activeSide === "front") {
      setFront((prev) => [prev, text].filter(Boolean).join(prev ? " " : ""));
    } else {
      setBack((prev) => [prev, text].filter(Boolean).join(prev ? " " : ""));
    }
  };

  const resetManualCardForm = () => {
    setFront("");
    setBack("");
    setFrontImageUri(null);
    setBackImageUri(null);
    setFrontBold(false);
    setBackBold(false);
    setFrontUnderline(false);
    setBackUnderline(false);
    setActiveSide("front");
    setIsCardKeyboardActive(false);
  };

  const launchCardCamera = async () => {
    suppressKeyboardHideRef.current = false;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("cameraPermissionRequired"), t("allowCameraNotes"));
      setIsCardKeyboardActive(true);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      allowsEditing: true,
    });
    setIsCardKeyboardActive(true);
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    if (activeSide === "front") setFrontImageUri(uri);
    else setBackImageUri(uri);
  };

  const launchCardLibrary = async () => {
    suppressKeyboardHideRef.current = false;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("photoPermissionRequired"), t("allowPhotoAdd"));
      setIsCardKeyboardActive(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      allowsEditing: true,
    });
    setIsCardKeyboardActive(true);
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    if (activeSide === "front") setFrontImageUri(uri);
    else setBackImageUri(uri);
  };

  const handleCardImagePress = () => {
    suppressKeyboardHideRef.current = true;
    Alert.alert(t("addPhoto"), "", [
      { text: t("takePhoto"), onPress: () => setTimeout(launchCardCamera, 50) },
      { text: t("uploadImages"), onPress: () => setTimeout(launchCardLibrary, 50) },
      { text: t("cancel"), style: "cancel", onPress: () => { suppressKeyboardHideRef.current = false; } },
    ]);
  };

  const toggleCardStyle = (style: "bold" | "underline") => {
    if (activeSide === "front") {
      if (style === "bold") setFrontBold((value) => !value);
      else setFrontUnderline((value) => !value);
      return;
    }

    if (style === "bold") setBackBold((value) => !value);
    else setBackUnderline((value) => !value);
  };

  const toggleCardVoiceInput = async () => {
    if (cardVoiceRecording) {
      const recording = cardVoiceRecording;
      setCardVoiceRecording(null);
      cardVoiceRecordingRef.current = null;
      setBusyLabel(t("transcribingSpeech"));
      try {
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const uri = recording.getURI();
        if (!uri) {
          Alert.alert(t("recordingFailed"), t("noAudioCreated"));
          return;
        }
        const { ext, mimeType } = mimeForAudio(uri);
        const transcript = await transcribeAudio(uri, `card-side-${Date.now()}.${ext}`, mimeType);
        if (transcript.trim()) updateActiveSideText(transcript.trim());
        else Alert.alert(t("noSpeechFound"), t("noClearSpeechRecording"));
      } catch (e: any) {
        Alert.alert(t("speechInputFailed"), e.message ?? t("pleaseTryAgain"));
      } finally {
        setBusyLabel("");
      }
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("microphonePermissionRequired"), t("allowVoiceInput"));
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setCardVoiceRecording(recording);
      cardVoiceRecordingRef.current = recording;
    } catch (e: any) {
      Alert.alert(t("recordingFailed"), e.message ?? t("pleaseTryAgain"));
    }
  };

  const pickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("photoPermissionRequired"), t("allowPhotoNotes"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.55,
      allowsMultipleSelection: true,
    });
    if (result.canceled) return;

    setBusyLabel(t("readingImages"));
    try {
      const texts = await Promise.all(result.assets.map((asset) => recognizeImage(asset)));
      setPhotoNotes((prev) => [prev, ...texts].filter(Boolean).join("\n\n"));
    } catch (e: any) {
      Alert.alert(t("imageReadingFailed"), e.message ?? t("pleaseTryAgain"));
    } finally {
      setBusyLabel("");
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("cameraPermissionRequired"), t("allowCameraNotes"));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.55,
    });
    if (result.canceled || !result.assets[0]) return;

    setBusyLabel(t("readingPhoto"));
    try {
      const text = await recognizeImage(result.assets[0]);
      setPhotoNotes((prev) => [prev, text].filter(Boolean).join("\n\n"));
      Alert.alert(t("photoAdded"), t("photoAddedText"), [
        { text: t("takeAnother"), onPress: takePhoto },
        { text: t("done") },
      ]);
    } catch (e: any) {
      Alert.alert(t("photoReadingFailed"), e.message ?? t("pleaseTryAgain"));
    } finally {
      setBusyLabel("");
    }
  };

  const handleAddCard = async () => {
    if (!activeDeck) return Alert.alert(t("notice"), t("deckFirst"));
    if (!front.trim() && !frontImageUri) return Alert.alert(t("notice"), t("frontEmpty"));
    if (!back.trim() && !backImageUri) return Alert.alert(t("notice"), t("backEmpty"));
    await insertCard(activeDeck.id, front.trim(), back.trim(), "fr", "zh", {
      frontImageUri,
      backImageUri,
      frontBold,
      backBold,
      frontUnderline,
      backUnderline,
    });
    resetManualCardForm();
    setCards(await getCardsForDeck(activeDeck.id));
    Alert.alert(t("created"), t("cardAddedToDeck", { name: activeDeck.name }));
  };

  const openImport = (kind: ImportKind) => {
    setImportMenuVisible(false);
    setActiveImport(kind);
    setAudioFile(null);
    setPhotoNotes("");
    setPastedNotes("");
  };

  const closeImport = () => {
    if (isRecording) stopRecording();
    setIsRecordingPaused(false);
    setRecordingScript("");
    setScriptVisible(false);
    setLanguagePickerVisible(false);
    setActiveImport(null);
  };

  const renderCreateOptions = () => (
    <>
      <View style={styles.optionCard}>
        <View style={styles.optionHeader}>
          <View style={styles.optionIcon}>
            <Ionicons name="albums-outline" size={22} color="#6fbd8a" />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>{t("createADeck")}</Text>
            <Text style={styles.optionSubtitle}>{t("createADeckSubtitle")}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <TextInput
            style={styles.inputInline}
            placeholder={t("newDeckName")}
            value={newDeckName}
            onChangeText={setNewDeckName}
          />
          <TouchableOpacity style={styles.btnSmall} onPress={handleCreateDeck} disabled={!!busyLabel}>
            <Text style={styles.btnSmallText}>{t("create")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.optionCard} onPress={() => setImportMenuVisible(true)}>
        <View style={styles.optionHeader}>
          <View style={[styles.optionIcon, styles.optionIconGreen]}>
            <Ionicons name="cloud-upload-outline" size={22} color="#6fbd8a" />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>{t("importADeck")}</Text>
            <Text style={styles.optionSubtitle}>{t("importADeckSubtitle")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        </View>
      </TouchableOpacity>
    </>
  );

  const renderAddCards = () => {
    if (!activeDeck) return null;
    const isDeckRoute = !!route.params?.deckId;
    const activeBold = activeSide === "front" ? frontBold : backBold;
    const activeUnderline = activeSide === "front" ? frontUnderline : backUnderline;
    const renderCardToolbar = () => (
      <View style={styles.cardToolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={handleCardImagePress}>
          <Ionicons name="image-outline" size={22} color="#6fbd8a" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarButton, activeBold && styles.toolbarButtonActive]}
          onPress={() => toggleCardStyle("bold")}
        >
          <Text style={[styles.toolbarTextButton, activeBold && styles.toolbarTextButtonActive]}>B</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarButton, activeUnderline && styles.toolbarButtonActive]}
          onPress={() => toggleCardStyle("underline")}
        >
          <Text style={[styles.toolbarTextButton, styles.toolbarUnderline, activeUnderline && styles.toolbarTextButtonActive]}>U</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarButton, cardVoiceRecording && styles.toolbarButtonRecording]}
          onPress={toggleCardVoiceInput}
        >
          <Ionicons name={cardVoiceRecording ? "stop" : "mic-outline"} size={22} color={cardVoiceRecording ? "#8f9f86" : "#6fbd8a"} />
        </TouchableOpacity>
      </View>
    );

    return (
      <View style={[styles.createCardShell, !isDeckRoute && styles.createCardEmbedded]}>
        <View style={styles.createCardHeader}>
          <View>
            <Text style={styles.createCardTitle}>{t("createCard")}</Text>
            <Text style={styles.createCardSubtitle}>{activeDeck.name}</Text>
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={handleAddCard} disabled={!!busyLabel}>
            <Text style={styles.saveButtonText}>{t("create")}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.sideEditor, activeSide === "front" && styles.sideEditorActive]}>
          <Text style={styles.sideLabel}>{t("frontSide")}</Text>
          {frontImageUri && (
            <View style={styles.cardImageWrap}>
              <Image source={{ uri: frontImageUri }} style={styles.cardImage} />
              <TouchableOpacity style={styles.removeImageButton} onPress={() => setFrontImageUri(null)}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          <TextInput
            style={[
              styles.sideInput,
              frontBold && styles.sideInputBold,
              frontUnderline && styles.sideInputUnderline,
            ]}
            placeholder={t("typeHere")}
            value={front}
            onChangeText={setFront}
            onFocus={() => {
              setActiveSide("front");
              setIsCardKeyboardActive(true);
            }}
            multiline
            textAlignVertical="top"
          />
        </View>
        {isCardKeyboardActive && activeSide === "front" && renderCardToolbar()}

        <View style={[styles.sideEditor, activeSide === "back" && styles.sideEditorActive]}>
          <Text style={styles.sideLabel}>{t("backSide")}</Text>
          {backImageUri && (
            <View style={styles.cardImageWrap}>
              <Image source={{ uri: backImageUri }} style={styles.cardImage} />
              <TouchableOpacity style={styles.removeImageButton} onPress={() => setBackImageUri(null)}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          <TextInput
            style={[
              styles.sideInput,
              styles.sideInputBack,
              backBold && styles.sideInputBold,
              backUnderline && styles.sideInputUnderline,
            ]}
            placeholder={t("typeHere")}
            value={back}
            onChangeText={setBack}
            onFocus={() => {
              setActiveSide("back");
              setIsCardKeyboardActive(true);
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 200);
            }}
            multiline
            textAlignVertical="top"
          />
        </View>
        {isCardKeyboardActive && activeSide === "back" && renderCardToolbar()}
      </View>
    );
  };

  const renderImportBody = () => {
    if (activeImport === "record") {
      return (
        <>
          {!audioFile ? (
            <View style={styles.recordPanel}>
              {isRecording ? (
                <View style={styles.recordingWave} pointerEvents="none">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <Animated.View
                      key={index}
                      style={[
                        styles.waveBar,
                        {
                          transform: [
                            {
                              scaleY: waveAnim.interpolate({
                                inputRange: [0, 0.25, 0.5, 0.75, 1],
                                outputRange:
                                  index % 2 === 0
                                    ? [0.45, 1.25, 0.7, 1.45, 0.45]
                                    : [1.2, 0.55, 1.5, 0.75, 1.2],
                              }),
                            },
                          ],
                          opacity: isRecordingPaused ? 0.45 : 1,
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.recordOnlyButton}
                  onPress={startRecording}
                  activeOpacity={0.82}
                >
                  <View style={styles.recordCircle}>
                    <Ionicons name="mic-outline" size={38} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}

              {isRecording && (
                <View style={styles.recordControls}>
                  <TouchableOpacity
                    style={styles.recordControlButton}
                    onPress={isRecordingPaused ? resumeRecording : pauseRecording}
                  >
                    <Ionicons name={isRecordingPaused ? "play" : "pause"} size={24} color="#6fbd8a" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.recordControlButton, styles.stopControlButton]} onPress={stopRecording}>
                    <Ionicons name="stop" size={24} color="#8f9f86" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.fileMeta}>{t("audioDuration", { duration: formatDuration(audioFile.durationMillis) })}</Text>
              <Text style={styles.languageLabel}>{t("aiFlashcardBackLanguage")}</Text>
              <TouchableOpacity
                style={styles.languageSelect}
                onPress={() => setLanguagePickerVisible((visible) => !visible)}
                activeOpacity={0.8}
              >
                <Text style={styles.languageSelectText}>{answerLanguage}</Text>
                <Ionicons name={languagePickerVisible ? "chevron-up" : "chevron-down"} size={20} color="#6fbd8a" />
              </TouchableOpacity>
              {languagePickerVisible && (
                <View style={styles.inlineLanguageList}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {ANSWER_LANGUAGE_OPTIONS.map((language) => (
                      <TouchableOpacity
                        key={language}
                        style={styles.languageListItem}
                        onPress={() => {
                          setAnswerLanguage(language);
                          setLanguagePickerVisible(false);
                        }}
                      >
                        <Text style={styles.languageListItemText}>{language}</Text>
                        {answerLanguage === language && <Ionicons name="checkmark" size={22} color="#6fbd8a" />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              <TouchableOpacity style={styles.btnAdd} onPress={generateFromAudio} disabled={!!busyLabel}>
                <Text style={styles.btnAddText}>{t("generateFlashcards")}</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      );
    }

    if (activeImport === "audio") {
      return (
        <>
          <TouchableOpacity style={styles.btnAdd} onPress={pickAudioFile}>
            <Ionicons name="musical-notes-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.btnAddText}>{t("importAction")}</Text>
          </TouchableOpacity>
          {audioFile && <Text style={styles.fileMeta}>{audioFile.name}</Text>}
          <TouchableOpacity style={styles.btnSecondaryWide} onPress={generateFromAudio} disabled={!audioFile || !!busyLabel}>
            <Text style={styles.btnSecondaryWideText}>{t("generateFlashcards")}</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (activeImport === "photo") {
      return (
        <>
          <View style={styles.row}>
            <TouchableOpacity style={styles.photoButton} onPress={pickPhotos}>
              <Ionicons name="images-outline" size={20} color="#6fbd8a" />
              <Text style={styles.photoButtonText}>{t("uploadImages")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={20} color="#6fbd8a" />
              <Text style={styles.photoButtonText}>{t("takePhoto")}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder={t("recognizedTextPlaceholder")}
            value={photoNotes}
            onChangeText={setPhotoNotes}
            multiline
          />
          <TouchableOpacity style={styles.btnSecondaryWide} onPress={() => createGeneratedDeck(photoNotes, "photo notes")} disabled={!photoNotes.trim() || !!busyLabel}>
            <Text style={styles.btnSecondaryWideText}>{t("generateDeck")}</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (activeImport === "notes") {
      return (
        <>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder={t("pasteNotesPlaceholder")}
            value={pastedNotes}
            onChangeText={setPastedNotes}
            multiline
          />
          <TouchableOpacity style={styles.btnSecondaryWide} onPress={() => createGeneratedDeck(pastedNotes, "pasted notes")} disabled={!pastedNotes.trim() || !!busyLabel}>
            <Text style={styles.btnSecondaryWideText}>{t("generateDeck")}</Text>
          </TouchableOpacity>
        </>
      );
    }

    return null;
  };

  const importTitle =
    activeImport === "record" && audioFile ? t("recordingComplete") :
    activeImport === "record" ? t("recordLecture") :
    activeImport === "audio" ? t("audioFile") :
    activeImport === "photo" ? t("photographNote") :
    activeImport === "notes" ? t("pasteNotes") : "";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
      <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!route.params?.deckId && (
          <>
            <Text style={styles.pageTitle}>{t("createDeckTitle")}</Text>
            <Text style={styles.pageSubtitle}>{t("createDeckSubtitle")}</Text>
            {renderCreateOptions()}
          </>
        )}
        {renderAddCards()}
        <View style={{ height: 40 }} />
      </ScrollView>

      {!!busyLabel && (
        <View style={styles.busyOverlay}>
          <View style={styles.busyBox}>
            <ActivityIndicator color="#6fbd8a" />
            <Text style={styles.busyText}>{busyLabel}</Text>
          </View>
        </View>
      )}

      <Modal visible={importMenuVisible} transparent animationType="fade" onRequestClose={() => setImportMenuVisible(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setImportMenuVisible(false)}
        >
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t("importADeck")}</Text>
            {[
              { label: "PDF", icon: "document-text-outline" as const, action: handleImportPdf },
              { label: t("recordLecture"), icon: "mic-outline" as const, action: () => openImport("record") },
              { label: t("audioFile"), icon: "musical-notes-outline" as const, action: () => openImport("audio") },
              { label: t("takePhotoOfText"), icon: "camera-outline" as const, action: () => openImport("photo") },
              { label: t("pasteNotes"), icon: "clipboard-outline" as const, action: () => openImport("notes") },
            ].map((item) => (
              <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.action}>
                <Ionicons name={item.icon} size={22} color="#6fbd8a" />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setImportMenuVisible(false)}>
              <Text style={styles.modalCancelText}>{t("cancel")}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!activeImport} transparent animationType="fade" onRequestClose={closeImport}>
        <View style={[styles.modalBackdrop, activeImport === "record" && styles.edgeModalBackdrop]}>
          <View style={[styles.modalBox, activeImport === "record" && styles.fullWidthModalBox, activeImport === "record" && audioFile && styles.recordingCompleteBox]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{importTitle}</Text>
              <TouchableOpacity onPress={closeImport}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {renderImportBody()}
          </View>
        </View>
      </Modal>

      <Modal visible={scriptVisible} transparent animationType="fade" onRequestClose={() => setScriptVisible(false)}>
        <KeyboardAvoidingView
          style={[styles.modalBackdrop, styles.edgeModalBackdrop]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalBox, styles.fullWidthModalBox]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("script")}</Text>
              <TouchableOpacity onPress={() => setScriptVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.scriptBox, styles.scriptInput]}
              value={recordingScript}
              onChangeText={setRecordingScript}
              multiline
              scrollEnabled
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.btnAdd} onPress={generateDeckFromRecordingScript} disabled={!recordingScript.trim() || !!busyLabel}>
              <Text style={styles.btnAddText}>{t("generateFlashcard")}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

<Modal visible={!!successDeck} transparent animationType="fade" onRequestClose={() => setSuccessDeck(null)}>
        <View style={[styles.modalBackdrop, styles.centeredModalBackdrop]}>
          <Animated.View
            style={[
              styles.modalBox,
              styles.successBox,
              {
                opacity: successAnim,
                transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) }],
              },
            ]}
          >
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={34} color="#fff" />
            </View>
            <Text style={styles.modalTitle}>{t("deckCreated")}</Text>
            <Text style={styles.successText}>
              {successDeck?.count
                ? t("flashcardsWereAdded", { count: successDeck.count, name: successDeck.name })
                : t("deckIsReady", { name: successDeck?.name ?? "" })}
            </Text>
            <TouchableOpacity
              style={styles.btnAdd}
              onPress={() => {
                if (successDeck) setActiveDeck({ id: successDeck.id, name: successDeck.name });
                setSuccessDeck(null);
              }}
            >
              <Text style={styles.btnAddText}>{t("startAddingCards")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnSecondaryWide}
              onPress={() => {
                setSuccessDeck(null);
                navigation.goBack();
              }}
            >
              <Text style={styles.btnSecondaryWideText}>{t("returnCardLibrary")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f7f2" },
  content: { padding: 16 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: "#1a1a2e", marginTop: 6 },
  pageSubtitle: { fontSize: 14, color: "#637083", lineHeight: 20, marginTop: 6, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#555", marginBottom: 10 },
  createCardShell: {
    flex: 1,
    minHeight: 620,
    backgroundColor: "#f1f7f2",
  },
  createCardEmbedded: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#d8e6dc",
  },
  createCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  createCardTitle: { fontSize: 28, fontWeight: "800", color: "#1a1a2e" },
  createCardSubtitle: { fontSize: 13, color: "#1a1a2e", fontWeight: "800", marginTop: 2 },
  saveButton: {
    backgroundColor: "#6fbd8a",
    minWidth: 82,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  sideTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  sideTab: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cfe0d4",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  sideTabActive: {
    backgroundColor: "#6fbd8a",
    borderColor: "#6fbd8a",
  },
  sideTabText: { fontSize: 14, fontWeight: "700", color: "#6fbd8a" },
  sideTabTextActive: { color: "#fff" },
  sideEditor: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 12,
    marginBottom: 12,
  },
  sideEditorActive: {
    borderColor: "#6fbd8a",
    shadowColor: "#6fbd8a",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sideLabel: { fontSize: 13, fontWeight: "800", color: "#637083", marginBottom: 8 },
  sideInput: {
    minHeight: 132,
    fontSize: 18,
    lineHeight: 26,
    color: "#1a1a2e",
    padding: 0,
  },
  sideInputBack: { color: "#355343" },
  sideInputBold: { fontWeight: "800" },
  sideInputUnderline: { textDecorationLine: "underline" },
  cardImageWrap: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#edf6ef",
    marginBottom: 10,
  },
  cardImage: { width: "100%", height: "100%" },
  removeImageButton: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(26,26,46,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardToolbar: {
    minHeight: 54,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cfe0d4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  toolbarButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7fbf8",
  },
  toolbarButtonActive: { backgroundColor: "#6fbd8a" },
  toolbarButtonRecording: { backgroundColor: "#f3f8f4", borderWidth: 1, borderColor: "#d7e5db" },
  toolbarTextButton: { fontSize: 19, fontWeight: "900", color: "#6fbd8a" },
  toolbarTextButtonActive: { color: "#fff" },
  toolbarUnderline: { textDecorationLine: "underline" },
  optionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#d8e6dc",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  optionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#edf6ef",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionIconGreen: { backgroundColor: "#e7f8f1" },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 17, fontWeight: "800", color: "#1a1a2e" },
  optionSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 3, lineHeight: 18 },
  row: { flexDirection: "row", gap: 8, marginBottom: 4 },
  inputInline: {
    flex: 1,
    backgroundColor: "#f7fbf8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#d8e2dc",
  },
  btnSmall: {
    backgroundColor: "#6fbd8a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: "center",
  },
  btnSmallText: { color: "#fff", fontWeight: "700" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    marginBottom: 10,
    minHeight: 50,
  },
  inputBack: { backgroundColor: "#edf6ef", borderColor: "#c7dacd", minHeight: 80 },
  notesInput: { minHeight: 180, textAlignVertical: "top" },
  btnAdd: {
    backgroundColor: "#6fbd8a",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "center",
  },
  btnAddText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnSecondaryWide: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#6fbd8a",
    marginTop: 4,
  },
  btnSecondaryWideText: { color: "#6fbd8a", fontWeight: "800", fontSize: 15 },
  photoButton: {
    flex: 1,
    backgroundColor: "#f7fbf8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cfe0d4",
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  photoButtonText: { color: "#6fbd8a", fontWeight: "700", fontSize: 13, textAlign: "center" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,0.42)",
    justifyContent: "flex-end",
    padding: 16,
  },
  centeredModalBackdrop: { justifyContent: "center" },
  edgeModalBackdrop: { paddingHorizontal: 0, paddingBottom: 0 },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  fullWidthModalBox: {
    width: "100%",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    minHeight: 310,
    paddingBottom: 24,
  },
  recordingCompleteBox: {
    minHeight: "50%",
    justifyContent: "space-between",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a2e", marginBottom: 12 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e7eee9",
  },
  menuItemText: { fontSize: 16, color: "#1f2937", fontWeight: "700", marginLeft: 12 },
  modalCancel: { alignItems: "center", paddingTop: 16 },
  modalCancelText: { color: "#6b7280", fontWeight: "700" },
  recordCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#8f9f86",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 18,
  },
  recordPanel: {
    minHeight: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingWave: {
    width: 118,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#f3f8f4",
    borderWidth: 1,
    borderColor: "#d7e5db",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginVertical: 18,
  },
  waveBar: {
    width: 8,
    height: 34,
    borderRadius: 4,
    backgroundColor: "#8f9f86",
  },
  recordOnlyButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
  },
  recordControls: {
    flexDirection: "row",
    gap: 18,
    justifyContent: "center",
    marginTop: 4,
  },
  recordControlButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#edf6ef",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cfe0d4",
  },
  stopControlButton: {
    backgroundColor: "#f3f8f4",
    borderColor: "#d7e5db",
  },
  fileMeta: { color: "#4b5563", textAlign: "center", marginBottom: 12, fontWeight: "600" },
  languageLabel: { color: "#4b5563", fontWeight: "700", marginBottom: 8, marginTop: 14 },
  languageSelect: {
    backgroundColor: "#f7fbf8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  languageSelectText: { color: "#1f2937", fontSize: 16, fontWeight: "700" },
  inlineLanguageList: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    maxHeight: 190,
    marginTop: -14,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  languageListItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e7eee9",
  },
  languageListItemText: { color: "#1f2937", fontSize: 16, fontWeight: "700" },
  scriptBox: {
    backgroundColor: "#f7fbf8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    maxHeight: 260,
    marginBottom: 12,
    padding: 12,
  },
  scriptInput: { minHeight: 220, color: "#1f2937", fontSize: 15, lineHeight: 22 },
  successBox: { alignItems: "stretch" },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#6fbd8a",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  successText: { color: "#4b5563", textAlign: "center", lineHeight: 20, marginBottom: 16 },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  busyBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    minWidth: 180,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  busyText: { marginTop: 10, color: "#1f2937", fontWeight: "700" },
});
