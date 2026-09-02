import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useFonts } from "expo-font";
import {
  Newsreader_300Light,
  Newsreader_300Light_Italic,
  Newsreader_400Regular
} from "@expo-google-fonts/newsreader";
import { KizukuApp } from "./src/KizukuApp";
import { color } from "./src/tokens";

export default function App() {
  const [fontsLoaded] = useFonts({
    Newsreader_300Light,
    Newsreader_300Light_Italic,
    Newsreader_400Regular,
    "Satoshi-Regular": require("./assets/fonts/Satoshi-Regular.ttf"),
    "Satoshi-Medium": require("./assets/fonts/Satoshi-Medium.ttf"),
    "Satoshi-SemiBold": require("./assets/fonts/Satoshi-SemiBold.ttf")
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
