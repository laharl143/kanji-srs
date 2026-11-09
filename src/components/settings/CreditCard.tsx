import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Linking, Pressable, Text, View } from "react-native";

import { Card } from "@/components/ui";
import type { Credit } from "@/lib/credits";
import { usePalette } from "@/theme/use-palette";

// One credit on /credits (spec 0010 AC-10). Each link opens in the phone's browser.
export function CreditCard({ credit }: { credit: Credit }) {
  const palette = usePalette();
  return (
    <View testID={`credit-${credit.id}`}>
      <Card>
        <Text className="text-sm font-bold uppercase text-muted">{credit.heading}</Text>
        <Text accessibilityRole="header" className="text-lg font-bold text-text">
          {credit.title}
        </Text>
        <Text className="text-base text-text">{credit.by}</Text>
        <Text className="text-base text-text">{credit.license}</Text>
        {credit.note && <Text className="text-base text-muted">{credit.note}</Text>}
        <View>
          {credit.links.map((link) => (
            <Pressable
              key={link.url}
              accessibilityRole="link"
              accessibilityLabel={`${link.label}, opens in the browser`}
              onPress={() => void Linking.openURL(link.url)}
              className="min-h-12 flex-row items-center gap-2 active:opacity-85"
            >
              <MaterialCommunityIcons name="open-in-new" size={20} color={palette.primary} />
              <Text className="flex-1 text-base font-medium text-primary">{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </View>
  );
}
