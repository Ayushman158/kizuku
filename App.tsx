import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useFonts } from "expo-font";
import { KizukuApp } from "./src/KizukuApp";
import { color } from "./src/tokens";

export default function App() {
  const [fontsLoaded] = useFonts({
    Newsreader_300Light: require("./assets/fonts/Newsreader_300Light.ttf"),
    Newsreader_300Light_Italic: require("./assets/fonts/Newsreader_300Light_Italic.ttf"),
    Newsreader_400Regular: require("./assets/fonts/Newsreader_400Regular.ttf"),
    "Satoshi-Regular": require("./assets/fonts/Satoshi-Regular.ttf"),
    "Satoshi-Medium": require("./assets/fonts/Satoshi-Medium.ttf"),
    "Satoshi-SemiBold": require("./assets/fonts/Satoshi-SemiBold.ttf"),
    "Caveat-Medium": require("./assets/fonts/Caveat-Medium.ttf")
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
