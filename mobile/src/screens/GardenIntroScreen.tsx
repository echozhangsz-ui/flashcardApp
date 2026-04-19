import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSystemLanguage } from "../i18n";

type GardenIntroScreenProps = {
  onDone: () => void;
};

type GrowthFrame = {
  key: string;
  source: ImageSourcePropType;
  color: string;
  background: string;
};

const FRAMES: GrowthFrame[] = [
  {
    key: "seed",
    source: require("../../assets/garden-intro/garden_seed.png"),
    color: "#7f9085",
    background: "#f4f8f5",
  },
  {
    key: "sprout",
    source: require("../../assets/garden-intro/garden_sprout.png"),
    color: "#8fa678",
    background: "#f1f7e9",
  },
  {
    key: "bud",
    source: require("../../assets/garden-intro/garden_bud.png"),
    color: "#6fbd8a",
    background: "#edf6ef",
  },
  {
    key: "bloom",
    source: require("../../assets/garden-intro/garden_bloom.png"),
    color: "#6fbd8a",
    background: "#edf6ef",
  },
];

const DROP_FROM_HERO_CENTER = -236;

const STORY_TEXT = [
  "You see a new word, like you got a seed.",
  "You keep reviewing it, it starts to grow in your memory.",
  "Keep practicing, it becomes more attached to your memory.",
  "Until it blooms in your memory and becomes part of your language.",
];

function animate(
  value: Animated.Value,
  toValue: number,
  duration: number,
  skipRef?: React.MutableRefObject<(() => void) | null>
) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (skipRef?.current === skip) skipRef.current = null;
      resolve();
    };
    const skip = () => {
      value.stopAnimation(() => {
        value.setValue(toValue);
        done();
      });
    };

    if (skipRef) skipRef.current = skip;

    const animation = Animated.timing(value, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start(() => done());
  });
}

function wait(duration: number, skipRef?: React.MutableRefObject<(() => void) | null>) {
  return new Promise<void>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (skipRef?.current === skip) skipRef.current = null;
      resolve();
    };
    const skip = () => done();

    if (skipRef) skipRef.current = skip;
    timer = setTimeout(done, duration);
  });
}

export default function GardenIntroScreen({ onDone }: GardenIntroScreenProps) {
  const { t } = useSystemLanguage();
  const stage = useRef(new Animated.Value(-0.5)).current;
  const messageOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);
  const skipStepRef = useRef<(() => void) | null>(null);
  const [message, setMessage] = useState("");
  const [showButton, setShowButton] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  const dropValues = useMemo(() => FRAMES.map(() => new Animated.Value(0)), []);
  const arrowValues = useMemo(() => FRAMES.slice(1).map(() => new Animated.Value(0)), []);

  const frameAnimations = useMemo(
    () =>
      FRAMES.map((_, index) => {
        if (index === 0) {
          return {
            opacity: stage.interpolate({
              inputRange: [-0.5, -0.06, 0.78, 1],
              outputRange: [0, 1, 1, 0],
              extrapolate: "clamp",
            }),
            scale: stage.interpolate({
              inputRange: [-0.5, -0.06, 1],
              outputRange: [0.86, 1.08, 1],
              extrapolate: "clamp",
            }),
          };
        }

        if (index === FRAMES.length - 1) {
          return {
            opacity: stage.interpolate({
              inputRange: [index - 0.28, index],
              outputRange: [0, 1],
              extrapolate: "clamp",
            }),
            scale: stage.interpolate({
              inputRange: [index - 0.35, index],
              outputRange: [0.96, 1.08],
              extrapolate: "clamp",
            }),
          };
        }

        return {
          opacity: stage.interpolate({
            inputRange: [index - 0.28, index, index + 0.28],
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          }),
          scale: stage.interpolate({
            inputRange: [index - 0.35, index, index + 0.35],
            outputRange: [0.96, 1.12, 1],
            extrapolate: "clamp",
          }),
        };
      }),
    [stage]
  );

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    let cancelled = false;

    const showStory = async (text: string) => {
      if (cancelled) return;
      setMessage(text);
      messageOpacity.setValue(0);
      await animate(messageOpacity, 1, 360, skipStepRef);
      await wait(820, skipStepRef);
    };

    const hideStory = async () => {
      await animate(messageOpacity, 0, 260, skipStepRef);
      if (!cancelled) setMessage("");
    };

    const dropFrame = async (index: number) => {
      dropValues[index].setValue(0);
      await animate(dropValues[index], 1, 680, skipStepRef);
    };

    const run = async () => {
      setShowButton(false);
      setMessage("");
      stage.setValue(-0.5);
      messageOpacity.setValue(0);
      buttonOpacity.setValue(0);
      dropValues.forEach((value) => value.setValue(0));
      arrowValues.forEach((value) => value.setValue(0));

      await animate(stage, 0, 620, skipStepRef);
      await wait(160, skipStepRef);
      await showStory(STORY_TEXT[0]);
      await dropFrame(0);
      await hideStory();
      await wait(220, skipStepRef);

      await animate(stage, 1, 860, skipStepRef);
      await showStory(STORY_TEXT[1]);
      Animated.timing(arrowValues[0], {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      await dropFrame(1);
      arrowValues[0].setValue(1);
      await hideStory();
      await wait(220, skipStepRef);

      await animate(stage, 2, 860, skipStepRef);
      await showStory(STORY_TEXT[2]);
      Animated.timing(arrowValues[1], {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      await dropFrame(2);
      arrowValues[1].setValue(1);
      await hideStory();
      await wait(220, skipStepRef);

      await animate(stage, 3, 900, skipStepRef);
      await showStory(STORY_TEXT[3]);
      Animated.timing(arrowValues[2], {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      await dropFrame(3);
      arrowValues[2].setValue(1);
      await hideStory();

      if (!cancelled) {
        setShowButton(true);
        await animate(buttonOpacity, 1, 420, skipStepRef);
      }
    };

    run();

    return () => {
      cancelled = true;
      skipStepRef.current = null;
    };
  }, [arrowValues, buttonOpacity, dropValues, messageOpacity, replayKey, stage]);

  return (
    <Pressable
      style={styles.screen}
      onPress={() => {
        if (!showButton) skipStepRef.current?.();
      }}
    >
      <View style={styles.content}>
        <View style={styles.copy}>
          <Text style={styles.title}>{t("gardenIntroTitle")}</Text>
        </View>

      <View style={styles.heroArea}>
        <View style={styles.heroStage}>
          <View style={styles.bloomGlow} />
          {FRAMES.map((frame, index) => {
            const frameStyle = frameAnimations[index];
            return (
              <Animated.Image
                key={frame.key}
                source={frame.source}
                resizeMode="contain"
                style={[
                  styles.growthFrame,
                  {
                    opacity: frameStyle.opacity,
                    transform: [{ scale: frameStyle.scale }],
                  },
                ]}
              />
            );
          })}
          {showButton ? (
            <Pressable
              accessibilityLabel="Replay intro animation"
              style={styles.replayButton}
              onPress={() => setReplayKey((value) => value + 1)}
            >
              <Ionicons name="sync" size={26} color="#6f987f" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.storyBox}>
        <Animated.Text style={[styles.storyText, { opacity: messageOpacity }]}>
          {message}
        </Animated.Text>
      </View>

      <View style={styles.timeline}>
        {FRAMES.map((frame, index) => {
          const value = dropValues[index];
          return (
            <React.Fragment key={frame.key}>
              <View style={styles.timelineSlot}>
                <Animated.View
                  style={[
                    styles.timelineBadge,
                    {
                      backgroundColor: frame.background,
                      borderColor: frame.color,
                      opacity: value,
                      transform: [
                        {
                          translateY: value.interpolate({
                            inputRange: [0, 1],
                            outputRange: [DROP_FROM_HERO_CENTER, 0],
                          }),
                        },
                        {
                          scale: value.interpolate({
                            inputRange: [0, 0.72, 1],
                            outputRange: [1.58, 1.1, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Image source={frame.source} resizeMode="contain" style={styles.timelineIcon} />
                </Animated.View>
              </View>
              {index < arrowValues.length ? (
                <Animated.View
                  style={[
                    styles.arrow,
                    {
                      opacity: arrowValues[index],
                      transform: [
                        {
                          scaleX: arrowValues[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.arrowLine} />
                  <View style={styles.arrowHead} />
                </Animated.View>
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

        <View style={styles.bottomArea}>
          {showButton ? (
            <Animated.View style={{ opacity: buttonOpacity, width: "100%" }}>
              <Pressable style={styles.skipButton} onPress={finish}>
                <Text style={styles.skipText}>{t("gardenIntroAction")}</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <View style={styles.buttonPlaceholder} />
          )}
          <Text style={styles.subtitle}>{t("gardenIntroSubtitle")}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f1f7f2",
    paddingHorizontal: 24,
    paddingBottom: 22,
  },
  content: {
    paddingTop: 122,
  },
  copy: {
    alignItems: "center",
  },
  title: {
    color: "#34483b",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 37,
    textAlign: "center",
  },
  storyBox: {
    alignItems: "center",
    height: 58,
    justifyContent: "center",
    marginTop: 4,
  },
  storyText: {
    color: "#53695a",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 19,
    maxWidth: 304,
    textAlign: "center",
  },
  heroArea: {
    alignItems: "center",
    height: 204,
    justifyContent: "center",
    marginTop: 10,
  },
  heroStage: {
    alignItems: "center",
    height: 190,
    justifyContent: "center",
    width: 220,
  },
  growthFrame: {
    height: 222,
    position: "absolute",
    width: 222,
  },
  bloomGlow: {
    backgroundColor: "#dfead8",
    borderRadius: 999,
    height: 150,
    opacity: 0.2,
    position: "absolute",
    width: 150,
  },
  replayButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    bottom: -8,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 38,
  },
  timeline: {
    flexDirection: "row",
    alignItems: "center",
    height: 86,
    justifyContent: "center",
    marginTop: 32,
    position: "relative",
  },
  arrow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginHorizontal: 4,
    transformOrigin: "left",
    width: 32,
  },
  arrowLine: {
    backgroundColor: "#8fb99d",
    borderRadius: 999,
    height: 4,
    width: 24,
  },
  arrowHead: {
    borderBottomColor: "transparent",
    borderBottomWidth: 6,
    borderLeftColor: "#8fb99d",
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderTopWidth: 6,
    height: 0,
    width: 0,
  },
  timelineSlot: {
    alignItems: "center",
    height: 78,
    justifyContent: "center",
    position: "relative",
    width: 50,
  },
  timelineBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    height: 50,
    justifyContent: "center",
    position: "absolute",
    shadowColor: "#8aa093",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    width: 50,
  },
  timelineIcon: {
    height: 48,
    width: 48,
  },
  bottomArea: {
    marginTop: 29,
  },
  buttonPlaceholder: {
    height: 52,
  },
  skipButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#6fbd8a",
    borderRadius: 8,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 24,
    width: "100%",
  },
  skipText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    color: "#6f8075",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 17,
    marginTop: 10,
    textAlign: "center",
  },
});
