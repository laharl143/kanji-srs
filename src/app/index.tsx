import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getDb } from "@/lib/db/client";
import { getMeta, setMeta } from "@/lib/db/queries/meta";
import { withTransaction } from "@/lib/db/transaction";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kanji SRS</Text>
      <Text style={styles.subtitle}>Scaffold is running.</Text>
      {__DEV__ && <RollbackCheck />}
    </View>
  );
}

const CHECK_KEY = "dev_rollback_check";

// Development only device check for spec 0002 AC-7: a write followed by a throw must leave no row.
function RollbackCheck() {
  const [result, setResult] = useState<string>();

  async function run() {
    const db = getDb();
    try {
      await withTransaction(db, async (tx) => {
        await setMeta(tx, CHECK_KEY, String(Date.now()));
        throw new Error("planned failure");
      });
    } catch {
      // Expected: the transaction always throws.
    }
    const row = await getMeta(db, CHECK_KEY);
    setResult(row === undefined ? "Rollback OK: no row written" : `Rollback FAILED: found ${row}`);
  }

  return (
    <View style={styles.devBox}>
      <Pressable accessibilityRole="button" onPress={run} style={styles.devButton}>
        <Text style={styles.devButtonText}>Run rollback check (dev)</Text>
      </Pressable>
      {result && <Text>{result}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 28, fontWeight: "600" },
  subtitle: { fontSize: 16, opacity: 0.7 },
  devBox: { marginTop: 24, alignItems: "center", gap: 8 },
  devButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  devButtonText: { fontSize: 14 },
});
