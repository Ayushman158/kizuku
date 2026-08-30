import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useFonts } from "expo-font";
import {
  Newsreader_300Light,
  Newsreader_300Light_Italic,
  Newsreader_400Regular
} from "@expo-google-fonts/newsreader";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold
} from "@expo-google-fonts/plus-jakarta-sans";
import { KizukuApp } from "./src/KizukuApp";
import { color } from "./src/tokens";

export default function App() {
  const [fontsLoaded] = useFonts({
    Newsreader_300Light,
    Newsreader_300Light_Italic,
    Newsreader_400Regular,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: color.paper[50] }} />;
  }

  return (
    <>
      <StatusBar style="dark" />
      <KizukuApp />
    </>
  );
}
