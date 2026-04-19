import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSystemLanguage } from "../i18n";

type GardenIntroScreenProps = {
  onDone: () => void;
};

type GrowthFrame = {
  key: string;
  source: ImageSourcePropType;
};

const FRAMES: GrowthFrame[] = [
  { key: "seed", source: require("../../assets/garden-intro/garden_seed.png") },
  { key: "sprout", source: require("../../assets/garden-intro/garden_sprout.png") },
  { key: "bud", source: require("../../assets/garden-intro/garden_bud.png") },
  { key: "bloom", source: require("../../assets/garden-intro/garden_bloom.png") },
];

export default function GardenIntroScreen({ onDone }: GardenIntroScreenProps) {
  const { t } = useSystemLanguage();
  const progress = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  const frameAnimations = useMemo(
    () =>
      FRAMES.map((_, index) => {
        const start = index / FRAMES.length;
        const peak = (index + 0.42) / FRAMES.length;
        const end = (index + 1) / FRAMES.length;
        const isLast = index === FRAMES.length - 1;

        return {
          opacity: progress.interpolate({
            inputRange: [
              Math.max(0, start - 0.08),
              peak,
              Math.min(1, isLast ? 1 : end + 0.08),
            ],
            outputRange: [0, 1, isLast ? 1 : 0],
            extrapolate: "clamp",
          }),
          scale: progress.interpolate({
            inputRange: [Math.max(0, start - 0.04), peak, Math.min(1, end + 0.04)],
            outputRange: [0.9, 1.12, 1],
            extrapolate: "clamp",
          }),
          lift: progress.interpolate({
            inputRange: [start, peak, end],
            outputRange: [14, -5, 0],
            extrapolate: "clamp",
          }),
        };
      }),
    [progress]
  );

  const glowOpacity = progress.interpolate({
    inputRange: [0.66, 0.86, 1],
    outputRange: [0, 0.32, 0.24],
    extrapolate: "clamp",
  });

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 4600,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [progress]);

  return (
    <View style={styles.screen}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{t("gardenIntroEyebrow")}</Text>
        <Text style={styles.title}>{t("gardenIntroTitle")}</Text>
        <Text style={styles.subtitle}>{t("gardenIntroSubtitle")}</Text>
      </View>

      <View style={styles.heroArea}>
        <Animated.View style={[styles.bloomGlow, { opacity: glowOpacity }]} />
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
                  transform: [
                    { translateY: frameStyle.lift },
                    { scale: frameStyle.scale },
                  ],
                },
              ]}
            />
          );
        })}
      </View>

      <Pressable style={styles.skipButton} onPress={finish}>
        <Text style={styles.skipText}>{t("gardenIntroAction")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2f8ff",
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 34,
    justifyContent: "space-between",
  },
  copy: {
    alignItems: "center",
  },
  eyebrow: {
    color: "#2f7a5a",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  title: {
    color: "#26384d",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
    lineHeight: 38,
  },
  subtitle: {
    color: "#607089",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 23,
    marginTop: 14,
    maxWidth: 320,
    textAlign: "center",
  },
  heroArea: {
    alignItems: "center",
    height: 304,
    justifyContent: "center",
  },
  growthFrame: {
    height: 220,
    position: "absolute",
    width: 220,
  },
  bloomGlow: {
    backgroundColor: "#fff2a8",
    borderRadius: 999,
    height: 172,
    opacity: 0.24,
    position: "absolute",
    width: 172,
  },
  skipButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#4a90d9",
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
});
