import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getFocusedRouteNameFromRoute, NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { BottomTabBarProps, createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { initApiBase } from "./src/api/client";
import HomeScreen from "./src/screens/HomeScreen";
import StudyScreen from "./src/screens/StudyScreen";
import AddCardScreen from "./src/screens/AddCardScreen";
import ChatScreen from "./src/screens/ChatScreen";
import DeckSettingsScreen from "./src/screens/DeckSettingsScreen";
import TutorSettingsScreen from "./src/screens/TutorSettingsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import AccountAuthScreen from "./src/screens/AccountAuthScreen";
import EmailRegisterScreen from "./src/screens/EmailRegisterScreen";
import ChangePasswordScreen from "./src/screens/ChangePasswordScreen";
import CardDetailScreen from "./src/screens/CardDetailScreen";
import GardenIntroScreen from "./src/screens/GardenIntroScreen";
import { useSystemLanguage } from "./src/i18n";

export type RootStackParamList = {
  Home: undefined;
  Study: { deckId: number; deckName: string };
  CardDetail: { card: any };
  AddCard: { deckId?: number; deckName?: string };
  DeckSettings: { deckId: number; deckName: string };
  Chat: undefined;
  TutorSettings: undefined;
  Profile: undefined;
  AccountAuth: undefined;
  EmailRegister: { displayName?: string; email?: string; password?: string } | undefined;
  ChangePassword: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const APP_BACKGROUND = "#f1f7f2";
const BAR_FOREGROUND = "#6fbd8a";
const AI_TUTOR_ICON = require("./assets/AITutor.png");

const headerStyle = {
  headerStyle: {
    backgroundColor: APP_BACKGROUND,
    borderBottomWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTintColor: BAR_FOREGROUND,
  headerTitleStyle: { fontWeight: "700" as const, color: BAR_FOREGROUND },
  headerBackTitleStyle: { fontWeight: "600" as const, color: BAR_FOREGROUND },
};

function HomeStack() {
  const { t } = useSystemLanguage();
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: t("cardLibrary") }} />
      <Stack.Screen
        name="Study"
        component={StudyScreen}
        options={{ title: "", headerBackTitle: t("cardLibrary") }}
      />
      <Stack.Screen name="CardDetail" component={CardDetailScreen} options={{ title: "", headerBackTitle: t("cardLibrary") }} />
      <Stack.Screen name="AddCard" component={AddCardScreen} options={{ title: "", headerBackTitle: t("cardLibrary") }} />
      <Stack.Screen name="DeckSettings" component={DeckSettingsScreen} options={{ title: "", headerBackTitle: t("cardLibrary") }} />
    </Stack.Navigator>
  );
}

function ChatStack() {
  const { t } = useSystemLanguage();
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ navigation }) => ({
          title: t("aiTutor"),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("TutorSettings")}
              style={{ paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <Ionicons name="settings-outline" size={22} color={BAR_FOREGROUND} />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="TutorSettings" component={TutorSettingsScreen} options={{ title: "", headerBackTitle: t("aiTutor") }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  const { t } = useSystemLanguage();
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "" }} />
      <Stack.Screen name="AccountAuth" component={AccountAuthScreen} options={{ title: "", headerBackTitle: t("profile") }} />
      <Stack.Screen name="EmailRegister" component={EmailRegisterScreen} options={{ title: "", headerBackTitle: t("account") }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: "", headerBackTitle: t("profile") }} />
    </Stack.Navigator>
  );
}

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useSystemLanguage();
  const focusedRoute = state.routes[state.index];
  const focusedNestedRoute = getFocusedRouteNameFromRoute(focusedRoute);
  const hiddenRoutes = ["AddCard", "DeckSettings", "Study", "CardDetail", "TutorSettings", "AccountAuth", "EmailRegister", "ChangePassword"];

  if (focusedNestedRoute && hiddenRoutes.includes(focusedNestedRoute)) {
    return null;
  }

  const cardsFocused = focusedRoute.name === "HomeTab";
  const tutorFocused = focusedRoute.name === "ChatTab";
  const profileFocused = focusedRoute.name === "ProfileTab";

  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.navigate("HomeTab")}
        activeOpacity={0.75}
      >
        <Ionicons name="albums-outline" size={24} color={cardsFocused ? BAR_FOREGROUND : "#bfd3c4"} />
        <Text style={[styles.tabLabel, { color: cardsFocused ? BAR_FOREGROUND : "#bfd3c4" }]}>{t("cards")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.navigate("ChatTab")}
        activeOpacity={0.75}
      >
        <Image source={AI_TUTOR_ICON} style={[styles.tutorIcon, !tutorFocused && styles.tabIconMuted]} />
        <Text style={[styles.tabLabel, { color: tutorFocused ? BAR_FOREGROUND : "#bfd3c4" }]}>{t("aiTutor")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.navigate("ProfileTab")}
        activeOpacity={0.75}
      >
        <Ionicons name="person-circle-outline" size={25} color={profileFocused ? BAR_FOREGROUND : "#bfd3c4"} />
        <Text style={[styles.tabLabel, { color: profileFocused ? BAR_FOREGROUND : "#bfd3c4" }]}>{t("profile")}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const { t } = useSystemLanguage();
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => { initApiBase(); }, []);

  if (showIntro) {
    return <GardenIntroScreen onDone={() => setShowIntro(false)} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={({ route }) => ({
          headerShown: false,
        })}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={{ title: t("cards") }}
        />
        <Tab.Screen
          name="ChatTab"
          component={ChatStack}
          options={{ title: t("aiTutor") }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileStack}
          options={{ title: t("profile") }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 64,
    backgroundColor: APP_BACKGROUND,
    borderTopWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -8 }],
  },
  tabLabel: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  tutorIcon: {
    width: 34,
    height: 34,
    resizeMode: "contain",
  },
  tabIconMuted: {
    opacity: 0.55,
  },
});
