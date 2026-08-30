import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useFonts } from "expo-font";
import {
  Newsreader_300Light,
  Newsreader_300Light_Italic,
  Newsreader_400Regular
} from "@expo-google-fonts/newsreader";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold
} from "@expo-google-fonts/hanken-grotesk";
import { KizukuApp } from "./src/KizukuApp";
import { color } from "./src/tokens";

export default function App() {
  const [fontsLoaded] = useFonts({
    Newsreader_300Light,
    Newsreader_300Light_Italic,
    Newsreader_400Regular,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold
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
