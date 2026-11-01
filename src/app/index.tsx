import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kanji SRS</Text>
      <Text style={styles.subtitle}>Scaffold is running.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 28, fontWeight: "600" },
  subtitle: { fontSize: 16, opacity: 0.7 },
});
