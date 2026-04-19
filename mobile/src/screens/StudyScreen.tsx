import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Alert,
  Image,
  ScrollView,
  Pressable,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { getCardsForDeck, getDailyStudyGoal, getDeckById, setCardBondLevel } from "../db/database";
import { useSystemLanguage } from "../i18n";
import { RootStackParamList } from "../../App";

type StudyRoute = RouteProp<RootStackParamList, "Study">;
type Nav = StackNavigationProp<RootStackParamList, "Study">;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_W - 32;
const CARD_HEIGHT = 360;
const BOND_SLIDE = 240;

const BOND_LEVELS = [
  { key: "new",  labelKey: "bondNew",  image: require("../../assets/bond-icons/bond_new.png"),  color: "#7f9085", background: "#f4f8f5" },
  { key: "hint", labelKey: "bondHint", image: require("../../assets/bond-icons/bond_hint.png"), color: "#8fa678", background: "#f1f7e9" },
  { key: "pal",  labelKey: "bondPal",  image: require("../../assets/bond-icons/bond_pal.png"),  color: "#6fbd8a", background: "#edf6ef" },
  { key: "mine", labelKey: "bondMine", image: require("../../assets/bond-icons/bond_mine.png"), color: "#6fbd8a", background: "#edf6ef" },
] as const;

const BOND_STYLE: Record<string, { borderColor: string }> = Object.fromEntries(
  BOND_LEVELS.map(l => [l.key, { borderColor: l.color }])
);

const DOT_R    = 5;
const CIRCLE_D = 120;
const RING     = CIRCLE_D + DOT_R * 2 + 16;
const RING_R   = RING / 2;
const STROKE   = 3;

interface Particle {
  xy: Animated.ValueXY;
  opacity: Animated.Value;
  color: string;
  targetX: number;
  targetY: number;
  haloSize: number;   // outer halo diameter for glow layers
  peakOpacity: number;
  animDelay: number;
  isTrail: boolean;
}

const measureRef = (ref: View): Promise<{ x: number; y: number; width: number; height: number }> =>
  new Promise((resolve) =>
    (ref as any).measureInWindow((x: number, y: number, w: number, h: number) =>
      resolve({ x, y, width: w, height: h })
    )
  );

// fillClock: 0→1 linear time. Each level applies its own easing to get a fill ratio.
function levelFillRatio(clock: number, proportion: number): number {
  if (proportion <= 0) return 0;
  // Large proportion → fast start (Easing.out with higher power)
  // Small proportion → slow start (Easing.in)
  if (proportion >= 0.45) return Easing.out(Easing.cubic)(clock);
  if (proportion >= 0.25) return Easing.out(Easing.quad)(clock);
  if (proportion >= 0.10) return Easing.inOut(Easing.quad)(clock);
  return Easing.in(Easing.quad)(clock); // tiny slice: slow to fill
}

function RingDots({ cards, fillClock = 1 }: { cards: any[]; fillClock?: number }) {
  const total = cards.length;
  const N = 160;
  const dotR = DOT_R;
  const trackR = RING_R - dotR - 2;

  const colorAt: (string | null)[] = new Array(N).fill(null);
  if (total > 0 && cards.some(c => c.bond_level)) {
    let pos = 0;
    for (const level of BOND_LEVELS) {
      const count = cards.filter((c: any) => c.bond_level === level.key).length;
      if (count > 0) {
        const proportion = count / total;
        const totalSlots = Math.round(proportion * N);
        const fill = levelFillRatio(fillClock, proportion);
        const visibleSlots = Math.round(totalSlots * fill);
        for (let i = 0; i < visibleSlots; i++) {
          if (pos < N) colorAt[pos++] = level.color;
        }
        // Advance past reserved slots so other levels stay in correct position
        pos += totalSlots - visibleSlots;
      }
    }
  }

  const segW = (2 * Math.PI * trackR / N) + 1;

  return (
    <>
      {colorAt.map((color, i) => {
        if (!color) return null;
        const deg = (i / N) * 360 - 90;
        const rad = (deg * Math.PI) / 180;
        const cx = RING_R + trackR * Math.cos(rad);
        const cy = RING_R + trackR * Math.sin(rad);
        return (
          <View key={i} style={{
            position: "absolute",
            width: segW, height: dotR * 2,
            borderRadius: 0,
            backgroundColor: color,
            left: cx - segW / 2,
            top: cy - dotR,
            transform: [{ rotate: `${deg + 90}deg` }],
          }} />
        );
      })}
    </>
  );
}

function RingStudyButton({ cards, onPress, fillClock }: {
  cards: any[];
  onPress: () => void;
  fillClock: number;
}) {
  return (
    <TouchableOpacity style={ringStyles.wrap} onPress={onPress} activeOpacity={0.82}>
      <View style={ringStyles.ringContainer}>
        <RingDots cards={cards} fillClock={fillClock} />
      </View>
      <View style={ringStyles.circle}>
        <Text style={ringStyles.circleLabel}>Study</Text>
      </View>
    </TouchableOpacity>
  );
}

const ringStyles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
    marginBottom: 20,
    width: RING + 8,
    height: RING + 8,
  },
  ringContainer: {
    position: "absolute",
    width: RING,
    height: RING,
  },
  circle: {
    width: CIRCLE_D,
    height: CIRCLE_D,
    borderRadius: CIRCLE_D / 2,
    backgroundColor: "#f1f7f2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  circleLabel: {
    color: "#1a1a2e",
    fontSize: 18,
    fontWeight: "700",
  },
});

function EmptyDeckView({ deckId, deckName }: { deckId: number; deckName: string }) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, "Study">>();
  return (
    <View style={styles.emptyDeckHome}>
      <TouchableOpacity
        style={[styles.deckSettingsButton, styles.deckSettingsButtonAbsolute]}
        activeOpacity={0.75}
        onPress={() => navigation.navigate("DeckSettings", { deckId, deckName })}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="settings-outline" size={22} color="#6fbd8a" />
      </TouchableOpacity>
      <View style={{ alignItems: "center", marginTop: -70 }}>
        <EmptyDeckAnimation />
        <Text style={emptyStyles.subtitle}>Create your card to grow your learning garden.</Text>
        <View style={[styles.fabAddCard, { marginTop: 28 }]}>
          <TouchableOpacity
            style={styles.fabAddCardInner}
            onPress={() => navigation.navigate("AddCard", { deckId, deckName })}
            activeOpacity={0.86}
          >
            <Ionicons name="add" size={26} color="#fff" />
            <Text style={styles.fabCreateCardText}>Card</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const GROWTH_FRAMES = [
  { key: "seed",   source: require("../../assets/garden-intro/garden_seed.png") },
  { key: "sprout", source: require("../../assets/garden-intro/garden_sprout.png") },
  { key: "bud",    source: require("../../assets/garden-intro/garden_bud.png") },
  { key: "bloom",  source: require("../../assets/garden-intro/garden_bloom.png") },
];

function EmptyDeckAnimation() {
  const frameValues = useMemo(
    () => GROWTH_FRAMES.map(() => ({ opacity: new Animated.Value(0), scale: new Animated.Value(0.96) })),
    []
  );

  useEffect(() => {
    frameValues.forEach(({ opacity, scale }) => { opacity.setValue(0); scale.setValue(0.96); });

    // Each frame overlaps the next: STEP < active duration so transitions blend together
    const STEP     = 620;   // ms between each frame's start
    const FADE_IN  = 450;
    const FADE_OUT = 380;
    const ACTIVE   = FADE_IN + FADE_OUT; // 830ms
    const CYCLE    = 2800;  // total loop duration (≥ (N-1)*STEP + ACTIVE)

    const anim = Animated.loop(
      Animated.parallel(
        frameValues.map(({ opacity, scale }, i) =>
          Animated.sequence([
            Animated.delay(i * STEP),
            Animated.parallel([
              Animated.timing(opacity, { toValue: 1,    duration: FADE_IN,  easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(scale,   { toValue: 1.08, duration: FADE_IN,  easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(opacity, { toValue: 0,    duration: FADE_OUT, easing: Easing.in(Easing.cubic),  useNativeDriver: true }),
              Animated.timing(scale,   { toValue: 0.96, duration: FADE_OUT, easing: Easing.in(Easing.cubic),  useNativeDriver: true }),
            ]),
            Animated.delay(CYCLE - i * STEP - ACTIVE),
          ])
        )
      )
    );

    anim.start();
    return () => anim.stop();
  }, [frameValues]);

  return (
    <View style={emptyStyles.stage}>
      <View style={emptyStyles.glow} />
      {GROWTH_FRAMES.map((frame, i) => (
        <Animated.Image
          key={frame.key}
          source={frame.source}
          resizeMode="contain"
          style={[emptyStyles.frame, { opacity: frameValues[i].opacity, transform: [{ scale: frameValues[i].scale }] }]}
        />
      ))}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  stage:    { alignItems: "center", height: 150, justifyContent: "center", width: 170 },
  glow:     { backgroundColor: "#dfead8", borderRadius: 999, height: 112, opacity: 0.18, position: "absolute", width: 112 },
  frame:    { height: 156, position: "absolute", width: 156 },
  subtitle: { fontSize: 14, color: "#9aaca0", textAlign: "center", marginTop: 18, lineHeight: 20, maxWidth: 220 },
});

const formatCreatedAt = (seconds?: number) => {
  if (!seconds) return "";
  const date = new Date(seconds * 1000);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function StudyScreen() {
  const route = useRoute<StudyRoute>();
  const navigation = useNavigation<Nav>();
  const { t } = useSystemLanguage();
  const { deckId, deckName } = route.params;

  const [currentDeckName, setCurrentDeckName] = useState(deckName);
  const [cards, setCards] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(20);

  // Ring fill animation
  const [fillClock, setFillClock] = useState(1); // 1 = fully shown before first animation
  const fillClockAnim = useRef(new Animated.Value(1)).current;
  const particleAnims = useRef<Particle[]>([]);
  const [particleKey, setParticleKey] = useState(0);

  // Refs for position measurement
  const deckHomeRef = useRef<View>(null);
  const ringWrapRef = useRef<View>(null);
  const cardItemRefs = useRef<(View | null)[]>([]);

  const bondSlideAnim = useRef(new Animated.Value(BOND_SLIDE)).current;
  const squeezeAnim   = useRef(new Animated.Value(0)).current;
  const enterAnim     = useRef(new Animated.Value(1)).current;
  const exitAnim      = useRef(new Animated.Value(1)).current;
  const isFlipping    = useRef(false);

  const resetCard = (animate = false) => {
    setFlipped(false);
    squeezeAnim.setValue(0);
    bondSlideAnim.setValue(BOND_SLIDE);
    isFlipping.current = false;
    exitAnim.setValue(1);
    if (animate) {
      enterAnim.setValue(0);
      Animated.spring(enterAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 130,
        friction: 12,
      }).start();
    } else {
      enterAnim.setValue(1);
    }
  };

  const triggerRingAnimation = async (freshCards: any[]) => {
    const bondCards = freshCards
      .map((card, i) => ({ card, idx: i }))
      .filter(({ card }) => card.bond_level);

    // Reset ring immediately to empty
    fillClockAnim.setValue(0);
    setFillClock(0);

    if (bondCards.length === 0) return;

    await new Promise(r => setTimeout(r, 350));

    if (!deckHomeRef.current || !ringWrapRef.current) return;

    const [homePos, ringPos] = await Promise.all([
      measureRef(deckHomeRef.current as any),
      measureRef(ringWrapRef.current as any),
    ]);

    const ringCX = ringPos.x - homePos.x + ringPos.width / 2;
    const ringCY = ringPos.y - homePos.y + ringPos.height / 2;
    const trackR = RING_R - DOT_R - 2;

    // Pre-measure all visible bond cards
    type MeasuredCard = { posX: number; posY: number; color: string; arcStart: number; arcEnd: number };
    const measured: MeasuredCard[] = [];
    const totalCards = freshCards.length;
    const levelArcStart: Record<string, number> = {};
    const levelArcEnd: Record<string, number>   = {};
    let cursor = -Math.PI / 2;
    for (const level of BOND_LEVELS) {
      const count = freshCards.filter((c: any) => c.bond_level === level.key).length;
      levelArcStart[level.key] = cursor;
      cursor += (count / totalCards) * 2 * Math.PI;
      levelArcEnd[level.key] = cursor;
    }

    for (const { card, idx } of bondCards) {
      const ref = cardItemRefs.current[idx];
      if (!ref) continue;
      const pos = await measureRef(ref as any);
      if (pos.y < -pos.height || pos.y > SCREEN_H) continue;
      const level = BOND_LEVELS.find(l => l.key === card.bond_level);
      if (!level) continue;
      measured.push({
        posX: pos.x - homePos.x + pos.width - 24,
        posY: pos.y - homePos.y + pos.height - 24,
        color: level.color,
        arcStart: levelArcStart[level.key],
        arcEnd: levelArcEnd[level.key],
      });
    }

    if (measured.length === 0) {
      fillClockAnim.setValue(1);
      setFillClock(1);
      return;
    }

    // Up to 4 shots per level, taken from visible cards of that level
    const MAX_PER_LEVEL = 4;
    const newParticles: Particle[] = [];
    let shotIndex = 0;

    for (const level of BOND_LEVELS) {
      const srcs = measured.filter(m => m.color === level.color);
      if (srcs.length === 0) continue;
      const shots = Math.min(srcs.length, MAX_PER_LEVEL);
      for (let s = 0; s < shots; s++) {
        const src = srcs[s % srcs.length];
        const staggerMs = shotIndex * 32;
        shotIndex++;

        const jx = (Math.random() - 0.5) * 14;
        const jy = (Math.random() - 0.5) * 14;
        const startX = src.posX + jx;
        const startY = src.posY + jy;
        const targetAngle = src.arcStart + Math.random() * (src.arcEnd - src.arcStart);
        const targetX = ringCX + trackR * Math.cos(targetAngle);
        const targetY = ringCY + trackR * Math.sin(targetAngle);

        // [haloSize, peakOpacity, trailDelay]
        const layers: [number, number, number][] = [
          [8,  0.95,  0],
          [5,  0.45, 75],
          [3,  0.20, 150],
        ];
        for (const [haloSize, peakOpacity, trailDelay] of layers) {
          const half = haloSize / 2;
          newParticles.push({
            xy: new Animated.ValueXY({ x: startX - half, y: startY - half }),
            opacity: new Animated.Value(0),
            color: level.color,
            targetX: targetX - half,
            targetY: targetY - half,
            haloSize,
            peakOpacity,
            animDelay: staggerMs + trailDelay,
            isTrail: trailDelay > 0,
          });
        }
      }
    }

    if (newParticles.length === 0) {
      fillClockAnim.setValue(1);
      setFillClock(1);
      return;
    }

    particleAnims.current = newParticles;
    setParticleKey(k => k + 1);

    // Launch particle animations
    newParticles.forEach((p) => {
      Animated.sequence([
        Animated.delay(p.animDelay),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: p.peakOpacity, duration: 80, useNativeDriver: true }),
          Animated.timing(p.xy, { toValue: { x: p.targetX, y: p.targetY }, duration: 480, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start(() => {
        Animated.timing(p.opacity, { toValue: 0, duration: 130, useNativeDriver: true }).start();
      });
    });

    // Fill clock: starts when first particles land, smooth independent animation
    // First particle lands at ~480ms; fill takes 900ms so all finish together.
    const FILL_START = 420;
    const FILL_DURATION = 450;
    setTimeout(() => {
      const listenerId = fillClockAnim.addListener(({ value }) => setFillClock(value));
      Animated.timing(fillClockAnim, {
        toValue: 1,
        duration: FILL_DURATION,
        easing: Easing.linear,  // each level applies its own easing inside RingDots
        useNativeDriver: false,
      }).start(({ finished }) => {
        fillClockAnim.removeListener(listenerId);
        if (finished) setFillClock(1);
        setTimeout(() => {
          particleAnims.current = [];
          setParticleKey(k => k + 1);
        }, 300);
      });
    }, FILL_START);
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const deck = await getDeckById(deckId);
        const data = await getCardsForDeck(deckId);
        const goal = await getDailyStudyGoal();
        setCurrentDeckName(deck?.name ?? deckName);
        cardItemRefs.current = new Array(data.length).fill(null);
        setCards(data);
        setDailyGoal(goal);
        setIndex(0);
        resetCard();
        setIsStudying(false);
        triggerRingAnimation(data);
      })();
    }, [deckId, deckName])
  );

  // When studying, disable swipe gesture and intercept back button
  React.useEffect(() => {
    // Disable iOS swipe-back while studying to prevent Library flash
    navigation.setOptions({ gestureEnabled: !isStudying });

    if (!isStudying) return;

    const backToDeck = () => {
      setIsStudying(false);
      resetCard();
      triggerRingAnimation(cards);
      return true;
    };

    const hardwareSub = BackHandler.addEventListener("hardwareBackPress", backToDeck);
    const navUnsub = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();
      backToDeck();
    });

    return () => {
      hardwareSub.remove();
      navUnsub();
    };
  }, [isStudying, cards]);

  const studyCards = cards.slice(0, dailyGoal);
  const card = studyCards[index];

  const flipCard = () => {
    if (isFlipping.current) return;
    isFlipping.current = true;
    const goingToBack = !flipped;

    if (!goingToBack) {
      Animated.timing(bondSlideAnim, {
        toValue: BOND_SLIDE,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }

    Animated.timing(squeezeAnim, {
      toValue: 1,
      duration: 160,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setFlipped(goingToBack);
      Animated.timing(squeezeAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        isFlipping.current = false;
        if (finished && goingToBack) {
          Animated.spring(bondSlideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 62,
            friction: 10,
          }).start();
        }
      });
    });
  };

  const goNext = () => {
    if (index >= studyCards.length - 1) {
      Alert.alert(t("done"), t("reviewedAllCards"), [
        { text: t("again"), onPress: () => { setIndex(0); resetCard(true); } },
        { text: t("back"), onPress: () => navigation.goBack() },
      ]);
      return;
    }
    setIndex(index + 1);
    resetCard(true);
  };

  const handleBondLevel = async (bondLevel: string) => {
    if (!card) return;
    await setCardBondLevel(card.id, bondLevel);
    setCards((prev) =>
      prev.map((item) => item.id === card.id ? { ...item, bond_level: bondLevel } : item)
    );

    // Slide bond panel away and shrink card simultaneously
    Animated.timing(bondSlideAnim, {
      toValue: BOND_SLIDE,
      duration: 160,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start();

    Animated.timing(exitAnim, {
      toValue: 0,
      duration: 210,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) goNext();
    });
  };

  const startStudy = () => {
    if (!studyCards.length) {
      Alert.alert(t("noCardsYet"), t("noCardsYetText"));
      return;
    }
    setIndex(0);
    resetCard();
    setIsStudying(true);
  };

  if (!isStudying) {
    if (cards.length === 0) {
      return <EmptyDeckView deckId={deckId} deckName={currentDeckName} />;
    }

    return (
      <View ref={deckHomeRef} style={styles.deckHome}>
        <ScrollView style={styles.container} contentContainerStyle={styles.deckContent}>
          <View style={styles.deckHeaderRow}>
            <Text style={styles.deckTitle}>{currentDeckName}</Text>
            <TouchableOpacity
              style={styles.deckSettingsButton}
              activeOpacity={0.75}
              onPress={() => navigation.navigate("DeckSettings", { deckId, deckName: currentDeckName })}
            >
              <Ionicons name="settings-outline" size={22} color="#6fbd8a" />
            </TouchableOpacity>
          </View>
          <Text style={styles.deckCount}>{cards.length} {t("cardsCount").toLowerCase()}</Text>

          <View ref={ringWrapRef} collapsable={false}>
            <RingStudyButton cards={cards} onPress={startStudy} fillClock={fillClock} />
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{t("allCards")}</Text>
          </View>

          {cards.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              ref={(el) => { cardItemRefs.current[i] = el as any; }}
              style={styles.listCard}
              activeOpacity={0.75}
              onPress={() => navigation.navigate("CardDetail", { card: item })}
            >
              <View style={styles.listSide}>
                <View style={styles.listSideRow}>
                  <Text style={styles.listSideText} numberOfLines={1} ellipsizeMode="tail">
                    {item.front || (item.front_image_uri ? t("image") : "")}
                  </Text>
                  <Text style={styles.createdAt}>{formatCreatedAt(item.created_at)}</Text>
                </View>
              </View>
              <View style={styles.listDivider} />
              <View style={styles.listSide}>
                <Text style={styles.listSideText} numberOfLines={1} ellipsizeMode="tail">
                  {item.back || (item.back_image_uri ? t("image") : "")}
                </Text>
              </View>
              {item.bond_level && (() => {
                const lvl = BOND_LEVELS.find(l => l.key === item.bond_level);
                return lvl ? <Image source={lvl.image} style={styles.listBondIcon} /> : null;
              })()}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Particle overlay — covers deckHome, pointerEvents none */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {particleAnims.current.map((p, i) => {
            const core = p.haloSize * 0.45;
            const mid  = p.haloSize * 0.7;
            return (
              <Animated.View
                key={`${particleKey}-${i}`}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: p.haloSize,
                  height: p.haloSize,
                  borderRadius: p.haloSize / 2,
                  backgroundColor: p.color + "18",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: p.opacity,
                  shadowColor: p.color,
                  shadowOpacity: 1,
                  shadowRadius: p.haloSize * 0.55,
                  shadowOffset: { width: 0, height: 0 },
                  transform: [{ translateX: p.xy.x }, { translateY: p.xy.y }],
                }}
              >
                {/* mid glow */}
                <View style={{
                  width: mid, height: mid,
                  borderRadius: mid / 2,
                  backgroundColor: p.color + "55",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {/* bright core */}
                  <View style={{
                    width: core, height: core,
                    borderRadius: core / 2,
                    backgroundColor: "#ffffff",
                    opacity: 0.92,
                  }} />
                </View>
              </Animated.View>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.fabCreateCard}
          onPress={() => navigation.navigate("AddCard", { deckId, deckName: currentDeckName })}
          activeOpacity={0.86}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabCreateCardText}>{t("cardSingular")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{currentDeckName}</Text>
        <Text style={styles.progress}>
          {index + 1} / {studyCards.length}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((index + 1) / studyCards.length) * 100}%` }]} />
      </View>

      {(() => {
        const scaleX = squeezeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.01] });
        const scaleY = squeezeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });
        const enterTranslateX = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [-CARD_WIDTH * 0.55, 0] });
        const enterOpacity    = enterAnim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] });
        const exitScale       = exitAnim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
        return (
          <View style={styles.cardContainer} pointerEvents="box-none">
            {/* entrance: slides in from left */}
            <Animated.View style={{ transform: [{ translateX: enterTranslateX }], opacity: enterOpacity }}>
            {/* exit: shrinks to nothing */}
            <Animated.View style={{ transform: [{ scale: exitScale }], opacity: exitAnim }}>
            <Animated.View style={[styles.cardStage, { transform: [{ scaleX }, { scaleY }] }]}>
              {!flipped ? (
                <View pointerEvents="none" style={[styles.card, styles.cardFront]}>
                  <Text style={styles.langLabel}>🇫🇷 French</Text>
                  {card?.front_image_uri && <Image source={{ uri: card.front_image_uri }} style={styles.cardImage} />}
                  {!!card?.front && (
                    <Text style={[styles.frontText, card?.front_bold ? styles.textBold : null, card?.front_underline ? styles.textUnderline : null]}>
                      {card.front}
                    </Text>
                  )}
                  <Text style={styles.tapHint}>{t("tapToReveal")}</Text>
                </View>
              ) : (
                <View pointerEvents="none" style={[styles.card, styles.cardBack]}>
                  <Text style={styles.langLabelBack}>{t("cardBackLabel")}</Text>
                  {card?.back_image_uri && <Image source={{ uri: card.back_image_uri }} style={styles.cardImage} />}
                  {!!card?.back && (
                    <Text style={[styles.backText, card?.back_bold ? styles.textBold : null, card?.back_underline ? styles.textUnderline : null]}>
                      {card.back}
                    </Text>
                  )}
                </View>
              )}
            </Animated.View>
            </Animated.View>
            </Animated.View>
          </View>
        );
      })()}

      <Pressable style={styles.cardPressLayer} onPress={flipCard} />

      <View style={styles.bondSlot} />

      <Animated.View
        pointerEvents={flipped ? "auto" : "none"}
        style={[styles.bondPanelWrapper, { transform: [{ translateY: bondSlideAnim }] }]}
      >
        <View style={styles.bondPanel}>
          <View style={styles.bondRow}>
            {BOND_LEVELS.map((level) => {
              const selected = (card?.bond_level ?? "new") === level.key;
              return (
                <TouchableOpacity
                  key={level.key}
                  style={[
                    styles.bondButton,
                    selected && { borderColor: level.color, backgroundColor: level.background },
                  ]}
                  onPress={() => handleBondLevel(level.key)}
                >
                  <Image source={level.image} style={styles.bondIcon} />
                  <Text style={[styles.bondLabel, selected && { color: level.color }]}>{t(level.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.bondQuestion}>{t("bondQuestion")}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f7f2", padding: 16 },
  deckHome: { flex: 1, backgroundColor: "#f1f7f2" },
  emptyDeckHome: {
    flex: 1,
    backgroundColor: "#f1f7f2",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    paddingTop: 8,
  },
  fabAddCard: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#6fbd8a",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 7,
  },
  fabAddCardInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
  },
  deckContent: { paddingBottom: 92 },
  deckHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  deckTitle: { flex: 1, fontSize: 22, fontWeight: "700", color: "#1a1a2e", marginTop: 4 },
  deckSettingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  deckSettingsButtonAbsolute: {
    position: "absolute",
    top: 8,
    right: 4,
  },
  deckCount: { fontSize: 15, color: "#637083", marginTop: 6, marginBottom: 18 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  listTitle: { fontSize: 14, fontWeight: "400", color: "#7f9085" },
  fabCreateCard: {
    position: "absolute",
    right: 22,
    bottom: 44,
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
  fabCreateCardText: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: -2 },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  listBondIcon: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    opacity: 0.85,
  },
  createdAt: {
    fontSize: 11,
    color: "#7f9085",
  },
  listSide: { paddingVertical: 4 },
  listSideRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  listSideLabel: {
    fontSize: 11,
    color: "#7f9085",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  listSideText: { fontSize: 15, lineHeight: 21, color: "#1a1a2e" },
  listDivider: { height: 1, backgroundColor: "#e7eee9", marginVertical: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  addLink: { color: "#6fbd8a", fontSize: 16, marginTop: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a2e", flex: 1 },
  progress: { fontSize: 14, color: "#888" },
  progressBar: { height: 4, backgroundColor: "#d8e2dc", borderRadius: 2, marginBottom: 24 },
  progressFill: { height: 4, backgroundColor: "#6fbd8a", borderRadius: 2 },
  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  cardStage: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  cardPressLayer: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 72,
    bottom: 166,
    zIndex: 10,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    position: "absolute",
    backfaceVisibility: "hidden",
  },
  cardFront: { backgroundColor: "#fff" },
  cardBack: { backgroundColor: "#6fbd8a" },
  langLabel: { fontSize: 13, color: "#999", marginBottom: 16 },
  langLabelBack: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 16 },
  cardImage: {
    width: "100%",
    height: 170,
    borderRadius: 14,
    marginBottom: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  frontText: { fontSize: 32, fontWeight: "700", color: "#1a1a2e", textAlign: "center", lineHeight: 44 },
  backText: { fontSize: 20, fontWeight: "500", color: "#fff", textAlign: "center", lineHeight: 32 },
  textBold: { fontWeight: "900" },
  textUnderline: { textDecorationLine: "underline" },
  tapHint: { position: "absolute", bottom: 18, fontSize: 12, color: "#ccc" },
  bondSlot: {
    height: 150,
  },
  bondPanelWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  bondPanel: {
    alignSelf: "stretch",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    padding: 12,
  },
  bondQuestion: {
    fontSize: 12,
    color: "#637083",
    textAlign: "center",
    marginTop: 10,
    fontWeight: "700",
  },
  bondRow: { flexDirection: "row", gap: 8, paddingHorizontal: 2 },
  bondButton: {
    flex: 1,
    minHeight: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e2dc",
    backgroundColor: "#f7fbf8",
    alignItems: "center",
    justifyContent: "center",
  },
  bondIcon: {
    width: 48,
    height: 48,
    marginBottom: 6,
  },
  bondLabel: { fontSize: 12, color: "#637083", fontWeight: "800" },
});
