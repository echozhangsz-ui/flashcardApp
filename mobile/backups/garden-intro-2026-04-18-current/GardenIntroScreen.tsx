import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Image,
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

type GrowthStep = {
  key: string;
  label: string;
  image: ImageSourcePropType;
  color: string;
};

const STEPS: GrowthStep[] = [
  {
    key: "seed",
    label: "Seed",
    image: require("../../assets/bond-icons/bond_new.png"),
    color: "#6f7785",
  },
  {
    key: "sprout",
    label: "Sprout",
    image: require("../../assets/bond-icons/bond_hint.png"),
    color: "#bf7a13",
  },
  {
    key: "bud",
    label: "Bud",
    image: require("../../assets/bond-icons/bond_pal.png"),
    color: "#357fc5",
  },
  {
    key: "bloom",
    label: "Bloom",
    image: require("../../assets/bond-icons/bond_mine.png"),
    color: "#168c58",
  },
];

export default function GardenIntroScreen({ onDone }: GardenIntroScreenProps) {
  const { t } = useSystemLanguage();
  const progress = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);

  const stepAnimations = useMemo(
    () =>
      STEPS.map((_, index) => {
        const start = index / STEPS.length;
        const middle = (index + 0.55) / STEPS.length;
        const end = (index + 1) / STEPS.length;

        return {
          opacity: progress.interpolate({
            inputRange: [Math.max(0, start - 0.08), middle, Math.min(1, end + 0.04)],
            outputRange: [0.3, 1, index === STEPS.length - 1 ? 1 : 0.72],
            extrapolate: "clamp",
          }),
          scale: progress.interpolate({
            inputRange: [start, middle, end],
            outputRange: [0.78, 1.16, 1],
            extrapolate: "clamp",
          }),
          lift: progress.interpolate({
            inputRange: [start, middle, end],
            outputRange: [8, -8, 0],
            extrapolate: "clamp",
          }),
        };
      }),
    [progress]
  );

  const heroImage = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 1, 2, 3, 3],
    extrapolate: "clamp",
  });

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 4300,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => animation.stop();
  }, [progress]);

  return (
    <Animated.View style={[styles.screen, { opacity: fadeOut }]}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{t("gardenIntroEyebrow")}</Text>
        <Text style={styles.title}>{t("gardenIntroTitle")}</Text>
        <Text style={styles.subtitle}>
          {t("gardenIntroSubtitle")}
        </Text>
      </View>

      <View style={styles.heroArea}>
        {STEPS.map((step, index) => {
          const stepStyle = stepAnimations[index];
          const display = heroImage.interpolate({
            inputRange: [index - 0.2, index, index + 0.8],
            outputRange: [0, 1, index === STEPS.length - 1 ? 1 : 0],
            extrapolate: "clamp",
          });

          return (
            <Animated.Image
              key={step.key}
              source={step.image}
              resizeMode="contain"
              style={[
                styles.heroPlant,
                {
                  opacity: display,
                  transform: [
                    { translateY: stepStyle.lift },
                    { scale: stepStyle.scale },
                  ],
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.pathArea}>
        <View style={styles.pathBase}>
          <Animated.View
            style={[
              styles.pathFill,
              {
                transform: [
                  {
                    scaleX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.02, 1],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          />
        </View>

        <View style={styles.stepRow}>
          {STEPS.map((step, index) => {
            const stepStyle = stepAnimations[index];
            return (
              <View key={step.key} style={styles.step}>
                <Animated.View
                  style={[
                    styles.stepIconWrap,
                    {
                      borderColor: step.color,
                      opacity: stepStyle.opacity,
                      transform: [
                        { translateY: stepStyle.lift },
                        { scale: stepStyle.scale },
                      ],
                    },
                  ]}
                >
                  <Image source={step.image} resizeMode="contain" style={styles.stepIcon} />
                </Animated.View>
                <Text style={[styles.stepLabel, { color: step.color }]} numberOfLines={1}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <Pressable style={styles.skipButton} onPress={finish}>
        <Text style={styles.skipText}>{t("gardenIntroAction")}</Text>
      </Pressable>
    </Animated.View>
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
    height: 188,
    justifyContent: "center",
  },
  heroPlant: {
    height: 154,
    position: "absolute",
    width: 154,
  },
  pathArea: {
    height: 126,
    justifyContent: "center",
  },
  pathBase: {
    backgroundColor: "#dcebf2",
    borderRadius: 8,
    height: 8,
    left: 34,
    overflow: "hidden",
    position: "absolute",
    right: 34,
    top: 44,
  },
  pathFill: {
    backgroundColor: "#83c796",
    borderRadius: 8,
    height: "100%",
    transformOrigin: "left",
    width: "100%",
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  step: {
    alignItems: "center",
    width: 70,
  },
  stepIconWrap: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 32,
    borderWidth: 2,
    height: 64,
    justifyContent: "center",
    shadowColor: "#5a7899",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    width: 64,
  },
  stepIcon: {
    height: 54,
    width: 54,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 12,
    textAlign: "center",
    width: "100%",
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
