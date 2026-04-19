import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { getAllDecks, deleteDeck, createDeck } from "../db/database";
import { RootStackParamList } from "../../App";
import { useSystemLanguage } from "../i18n";

type Nav = StackNavigationProp<RootStackParamList, "Home">;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

type GrowthFrame = {
  key: string;
  source: ImageSourcePropType;
};

const EMPTY_DECK_GROWTH_FRAMES: GrowthFrame[] = [
  { key: "seed",   source: require("../../assets/garden-intro/garden_seed.png") },
  { key: "sprout", source: require("../../assets/garden-intro/garden_sprout.png") },
  { key: "bud",    source: require("../../assets/garden-intro/garden_bud.png") },
  { key: "bloom",  source: require("../../assets/garden-intro/garden_bloom.png") },
];

function EmptyDeckGrowthAnimation() {
  const frameValues = useMemo(
    () =>
      EMPTY_DECK_GROWTH_FRAMES.map(() => ({
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0.96),
      })),
    []
  );

  useEffect(() => {
    frameValues.forEach(({ opacity, scale }) => {
      opacity.setValue(0);
      scale.setValue(0.96);
    });

    const animation = Animated.loop(
      Animated.sequence([
        ...frameValues.flatMap(({ opacity, scale }) => [
          Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(scale,   { toValue: 1.08, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
          Animated.delay(100),
          Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(scale,   { toValue: 1,  duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          ]),
          Animated.timing(scale, { toValue: 0.96, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(240),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [frameValues]);

  return (
    <View style={styles.emptyGrowthStage}>
      <View style={styles.emptyGrowthGlow} />
      {EMPTY_DECK_GROWTH_FRAMES.map((frame, index) => {
        const frameStyle = frameValues[index];
        return (
          <Animated.Image
            key={frame.key}
            source={frame.source}
            resizeMode="contain"
            style={[
              styles.emptyGrowthFrame,
              { opacity: frameStyle.opacity, transform: [{ scale: frameStyle.scale }] },
            ]}
          />
        );
      })}
    </View>
  );
}

const MENU_ITEMS = [
  { id: "create",  icon: "albums-outline",        label: "Create a deck" },
  { id: "pdf",     icon: "document-outline",       label: "Import PDF" },
  { id: "record",  icon: "mic-outline",            label: "Record lecture" },
  { id: "audio",   icon: "musical-notes-outline",  label: "Import audio file" },
  { id: "photo",   icon: "camera-outline",         label: "Take a photo of text" },
  { id: "notes",   icon: "clipboard-outline",      label: "Paste your notes" },
] as const;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useSystemLanguage();
  const [decks, setDecks] = useState<any[]>([]);
  const fabPulse = useRef(new Animated.Value(1)).current;

  // Bottom sheet state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  // Create deck dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");

  const loadDecks = useCallback(async () => {
    const data = await getAllDecks();
    setDecks(data);
  }, []);

  useFocusEffect(
    useCallback(() => { loadDecks(); }, [loadDecks])
  );

  useEffect(() => {
    if (decks.length !== 0) {
      fabPulse.stopAnimation();
      fabPulse.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, { toValue: 1.1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fabPulse, { toValue: 1,   duration: 360, easing: Easing.in(Easing.cubic),  useNativeDriver: true }),
        Animated.delay(280),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [decks.length, fabPulse]);

  const openMenu = () => {
    setMenuOpen(true);
    Animated.spring(menuAnim, {
      toValue: 1,
      tension: 72,
      friction: 12,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setMenuOpen(false));
  };

  const handleMenuOption = (id: string) => {
    if (id === "create") {
      closeMenu();
      setTimeout(() => setCreateDialogOpen(true), 240);
      return;
    }
    closeMenu();
    // All import options go to AddCard (current flow)
    setTimeout(() => navigation.navigate("AddCard", { deckId: undefined }), 240);
  };

  const handleCreateDeck = async () => {
    const name = newDeckName.trim();
    if (!name) return;
    const id = await createDeck(name);
    setNewDeckName("");
    setCreateDialogOpen(false);
    await loadDecks();
    navigation.navigate("Study", { deckId: id, deckName: name });
  };

  const handleDeleteDeck = (id: number, name: string) => {
    Alert.alert(t("deleteDeck"), t("deleteDeckQuestion", { name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          await deleteDeck(id);
          loadDecks();
        },
      },
    ]);
  };

  const sheetTranslateY = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });
  const backdropOpacity = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  return (
    <View style={styles.container}>
      {decks.length === 0 ? (
        <View style={styles.empty}>
          <EmptyDeckGrowthAnimation />
          <Text style={styles.emptyText}>{t("noDecks")}</Text>
        </View>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 96 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.deckCard}
              onPress={() => navigation.navigate("Study", { deckId: item.id, deckName: item.name })}
              onLongPress={() => handleDeleteDeck(item.id, item.name)}
            >
              <View style={styles.deckCardLeft}>
                <Ionicons name="layers-outline" size={22} color="#6fbd8a" style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.deckName}>{item.name}</Text>
                  <Text style={styles.deckCount}>{item.card_count} {t("cardsCount").toLowerCase()}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6fbd8a" />
            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB */}
      <AnimatedTouchableOpacity
        style={[
          styles.fabNewDeck,
          decks.length === 0 ? { transform: [{ scale: fabPulse }] } : null,
        ]}
        onPress={openMenu}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.fabNewDeckText}>{t("deck")}</Text>
      </AnimatedTouchableOpacity>

      {/* Bottom sheet menu */}
      {menuOpen && (
        <Modal transparent animationType="none" onRequestClose={closeMenu}>
          <View style={StyleSheet.absoluteFill}>
            {/* Backdrop */}
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: backdropOpacity }]}
            />
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />

            {/* Sheet */}
            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
              {/* Handle + header */}
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Add to your library</Text>
                <TouchableOpacity onPress={closeMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color="#637083" />
                </TouchableOpacity>
              </View>

              {/* Options */}
              {MENU_ITEMS.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.sheetItem, index === MENU_ITEMS.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => handleMenuOption(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sheetItemIcon}>
                    <Ionicons name={item.icon as any} size={20} color="#6fbd8a" />
                  </View>
                  <Text style={styles.sheetItemLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#b8c8bd" />
                </TouchableOpacity>
              ))}
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Create deck name dialog */}
      {createDialogOpen && (
        <Modal transparent animationType="fade" onRequestClose={() => setCreateDialogOpen(false)}>
          <KeyboardAvoidingView
            style={styles.dialogBackdrop}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateDialogOpen(false)} />
            <View style={styles.dialog}>
              <Text style={styles.dialogTitle}>Name your deck</Text>
              <TextInput
                style={styles.dialogInput}
                placeholder="e.g. French vocabulary"
                placeholderTextColor="#aebfb4"
                value={newDeckName}
                onChangeText={setNewDeckName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateDeck}
              />
              <View style={styles.dialogRow}>
                <TouchableOpacity
                  style={styles.dialogCancel}
                  onPress={() => { setCreateDialogOpen(false); setNewDeckName(""); }}
                >
                  <Text style={styles.dialogCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dialogCreate, !newDeckName.trim() && { opacity: 0.4 }]}
                  onPress={handleCreateDeck}
                  disabled={!newDeckName.trim()}
                >
                  <Text style={styles.dialogCreateText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f7f2", padding: 16 },
  fabNewDeck: {
    position: "absolute",
    right: 22,
    bottom: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#6fbd8a",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 7,
  },
  fabNewDeckText: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: -2 },
  deckCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  deckCardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  deckName: { fontSize: 16, fontWeight: "600", color: "#1a1a2e" },
  deckCount: { fontSize: 13, color: "#888", marginTop: 3 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyGrowthStage: { alignItems: "center", height: 150, justifyContent: "center", width: 170 },
  emptyGrowthGlow: { backgroundColor: "#dfead8", borderRadius: 999, height: 112, opacity: 0.18, position: "absolute", width: 112 },
  emptyGrowthFrame: { height: 156, position: "absolute", width: 156 },
  emptyText: { color: "#aaa", fontSize: 16, textAlign: "center", lineHeight: 26, marginTop: 4 },

  // Bottom sheet
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d8e2dc",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f7f3",
  },
  sheetItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#edf6ef",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  sheetItemLabel: { flex: 1, fontSize: 15, color: "#1a1a2e", fontWeight: "500" },

  // Create deck dialog
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a2e", marginBottom: 16 },
  dialogInput: {
    backgroundColor: "#f2f7f3",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1a1a2e",
    marginBottom: 20,
  },
  dialogRow: { flexDirection: "row", gap: 10 },
  dialogCancel: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    alignItems: "center",
    justifyContent: "center",
  },
  dialogCancelText: { fontSize: 15, fontWeight: "600", color: "#637083" },
  dialogCreate: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#6fbd8a",
    alignItems: "center",
    justifyContent: "center",
  },
  dialogCreateText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
