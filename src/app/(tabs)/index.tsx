import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button, Card, Screen } from "@/components/ui";
import { getDb } from "@/lib/db/client";
import { getMeta, setMeta } from "@/lib/db/queries/meta";
import { withTransaction } from "@/lib/db/transaction";

export default function HomeScreen() {
  return (
    <Screen bottomInset={false}>
      <Card title="Welcome">
        <Text className="text-base text-primary">Scaffold is running.</Text>
      </Card>
      {__DEV__ && <DevTools />}
    </Screen>
  );
}

const CHECK_KEY = "dev_rollback_check";

// Development only tools: the UI preview link (spec 0003 AC-7) and the device check for
// spec 0002 AC-7 (a write followed by a throw must leave no row).
function DevTools() {
  const router = useRouter();
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
    <Card title="Developer">
      <View className="gap-2">
        <Button
          label="UI preview (dev)"
          icon="palette"
          variant="secondary"
          onPress={() => router.push("/dev/ui")}
        />
        <Button label="Run rollback check (dev)" variant="secondary" onPress={run} />
        {result && <Text className="text-base text-text">{result}</Text>}
      </View>
    </Card>
  );
}
