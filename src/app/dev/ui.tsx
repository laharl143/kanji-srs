import { Redirect, Stack } from "expo-router";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import {
  Button,
  Card,
  ConfirmDialog,
  ProgressBar,
  Screen,
  StageDot,
  SubjectChip,
  useToast,
} from "@/components/ui";
import type { SubjectType } from "@/lib/types";
import { stageGroup } from "@/theme/stage";

// Development only preview of every base component (spec 0003 AC-7).
export default function DevUiRoute() {
  // "/(tabs)/index" lands on an unmatched route; "/index" resolves to the Home tab.
  if (!__DEV__) return <Redirect href="/index" />;
  return <DevUiScreen />;
}

// Open data samples (no WaniKani content).
const samples: { id: number; type: SubjectType; characters: string; meaning: string }[] = [
  { id: 1, type: "radical", characters: "一", meaning: "one" },
  { id: 2, type: "kanji", characters: "人", meaning: "person" },
  { id: 3, type: "vocab", characters: "大人", meaning: "adult" },
];

// One sample stage per group, in order.
const stages: (number | null)[] = [null, 0, 1, 5, 7, 8, 9];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <View className="gap-3">{children}</View>
    </Card>
  );
}

function DevUiScreen() {
  const toast = useToast();
  const [dialog, setDialog] = useState<"none" | "default" | "danger">("none");
  const close = () => setDialog("none");

  return (
    <Screen>
      <Stack.Screen options={{ title: "UI preview" }} />

      <Section title="Buttons">
        <Button label="Primary" onPress={() => toast.show("Primary pressed")} />
        <Button label="With icon" icon="check" onPress={() => toast.show("Icon pressed")} />
        <Button label="Secondary" variant="secondary" onPress={() => toast.show("Secondary")} />
        <Button label="Danger" variant="danger" onPress={() => toast.show("Danger")} />
        <Button label="Disabled" disabled onPress={() => {}} />
        <Button label="Loading" loading onPress={() => {}} />
      </Section>

      <Section title="Cards">
        <Card title="Plain card">
          <Text className="text-base text-text">Body text on a surface.</Text>
          <Text className="text-sm text-muted">Muted secondary text.</Text>
        </Card>
        <Card title="Pressable card" onPress={() => toast.show("Card pressed")}>
          <Text className="text-base text-text">Tap me.</Text>
        </Card>
      </Section>

      <Section title="Subject chips">
        {(["sm", "md", "lg"] as const).map((size) => (
          <View key={size} className="flex-row flex-wrap gap-2">
            {samples.map((s) => (
              <SubjectChip key={s.id} subject={s} size={size} />
            ))}
          </View>
        ))}
        <Text className="text-sm text-muted">Every stage (kanji 直, then locked first):</Text>
        <View className="flex-row flex-wrap gap-2">
          {stages.map((stage) => (
            <SubjectChip
              key={String(stage)}
              subject={{ id: 4, type: "kanji", characters: "直", meaning: "straight" }}
              stage={stage}
              size="sm"
            />
          ))}
        </View>
        <Text className="font-jp text-base text-text">
          Regular: 直 骨 人 大人 · <Text className="font-jp-bold">Bold: 直 骨</Text>
        </Text>
      </Section>

      <Section title="Stage dots">
        {stages.map((stage) => (
          <View key={String(stage)} className="flex-row items-center gap-2">
            <StageDot stage={stage} size={12} />
            <Text className="text-base text-text">
              {stageGroup(stage).label} ({stage === null ? "no assignment" : `stage ${stage}`})
            </Text>
          </View>
        ))}
      </Section>

      <Section title="Progress bars">
        <ProgressBar label="Primary, 3 of 10" value={3} max={10} />
        <ProgressBar label="Radical, 90% marker" value={8} max={10} marker={0.9} color="radical" />
        <ProgressBar label="Kanji, full" value={12} max={10} color="kanji" />
        <ProgressBar label="Vocab, empty (max 0)" value={4} max={0} color="vocab" />
      </Section>

      <Section title="Toasts">
        <Button label="Info toast" variant="secondary" onPress={() => toast.show("Saved")} />
        <Button
          label="Success toast"
          variant="secondary"
          onPress={() => toast.show("Correct!", { tone: "success" })}
        />
        <Button
          label="Error toast"
          variant="secondary"
          onPress={() => toast.show("Something went wrong", { tone: "error" })}
        />
      </Section>

      <Section title="Confirm dialogs">
        <Button label="Open default dialog" onPress={() => setDialog("default")} />
        <Button label="Open RESET dialog" variant="danger" onPress={() => setDialog("danger")} />
      </Section>

      <ConfirmDialog
        visible={dialog === "default"}
        title="Start lessons?"
        message="You have 5 new items ready."
        confirmLabel="Start"
        onConfirm={() => {
          close();
          toast.show("Confirmed", { tone: "success" });
        }}
        onCancel={() => {
          close();
          toast.show("Cancelled");
        }}
      />
      <ConfirmDialog
        visible={dialog === "danger"}
        title="Reset all progress?"
        message="This cannot be undone. Type RESET to confirm."
        confirmLabel="Reset"
        tone="danger"
        requireText="RESET"
        onConfirm={() => {
          close();
          toast.show("Reset confirmed", { tone: "error" });
        }}
        onCancel={() => {
          close();
          toast.show("Cancelled");
        }}
      />
    </Screen>
  );
}
