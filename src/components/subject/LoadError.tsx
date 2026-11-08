import { Text } from "react-native";

import { Button, Card } from "@/components/ui";

// A failed local load (spec 0009 AC-12): the message and Try again.
export function LoadError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card title={title}>
      <Text testID="load-error" className="text-base text-muted">
        {message}
      </Text>
      <Button label="Try again" variant="secondary" testID="load-retry" onPress={onRetry} />
    </Card>
  );
}
