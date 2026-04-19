import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Image,
  Pressable,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../App";

type CardDetailRoute = RouteProp<RootStackParamList, "CardDetail">;
type Nav = StackNavigationProp<RootStackParamList, "CardDetail">;

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_W - 32;
const CARD_HEIGHT = 360;

export default function CardDetailScreen() {
  const route = useRoute<CardDetailRoute>();
  const navigation = useNavigation<Nav>();
  const { card } = route.params;

  const [flipped, setFlipped] = useState(false);
  const squeezeAnim = useRef(new Animated.Value(0)).current;
  const isFlipping  = useRef(false);

  const flipCard = () => {
    if (isFlipping.current) return;
    isFlipping.current = true;
    const goingToBack = !flipped;

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
      }).start(() => {
        isFlipping.current = false;
      });
    });
  };

  const scaleX = squeezeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.01] });
  const scaleY = squeezeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });

  return (
    <Pressable style={styles.container} onPress={flipCard}>
      <Animated.View style={[styles.cardStage, { transform: [{ scaleX }, { scaleY }] }]}>
        {!flipped ? (
          <View pointerEvents="none" style={[styles.card, styles.cardFront]}>
            <Text style={styles.langLabel}>🇫🇷 French</Text>
            {card.front_image_uri && (
              <Image source={{ uri: card.front_image_uri }} style={styles.cardImage} />
            )}
            {!!card.front && (
              <Text style={[styles.frontText, card.front_bold && styles.textBold, card.front_underline && styles.textUnderline]}>
                {card.front}
              </Text>
            )}
            <Text style={styles.tapHint}>tap to reveal</Text>
          </View>
        ) : (
          <View pointerEvents="none" style={[styles.card, styles.cardBack]}>
            <Text style={styles.langLabelBack}>Chinese / Notes</Text>
            {card.back_image_uri && (
              <Image source={{ uri: card.back_image_uri }} style={styles.cardImage} />
            )}
            {!!card.back && (
              <Text style={[styles.backText, card.back_bold && styles.textBold, card.back_underline && styles.textUnderline]}>
                {card.back}
              </Text>
            )}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f7f2",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    paddingBottom: 120,
  },
  cardStage: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
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
  },
  cardFront: { backgroundColor: "#fff" },
  cardBack:  { backgroundColor: "#6fbd8a" },
  langLabel:     { fontSize: 13, color: "#999", marginBottom: 16 },
  langLabelBack: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 16 },
  cardImage: {
    width: "100%",
    height: 170,
    borderRadius: 14,
    marginBottom: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  frontText: { fontSize: 32, fontWeight: "700", color: "#1a1a2e", textAlign: "center", lineHeight: 44 },
  backText:  { fontSize: 20, fontWeight: "500", color: "#fff",    textAlign: "center", lineHeight: 32 },
  textBold:      { fontWeight: "900" },
  textUnderline: { textDecorationLine: "underline" },
  tapHint: { position: "absolute", bottom: 18, fontSize: 12, color: "#ccc" },
});
