import { useRouter } from "expo-router";

import { MessageCard } from "@/components/study/SessionStates";

// A rejected param, an unknown id, or an empty level (spec 0009 AC-11). Back walks the stack,
// or goes Home when there is nothing to go back to.
export function NotFound({ what }: { what: string }) {
  const router = useRouter();
  return (
    <MessageCard
      icon="magnify-close"
      title="Not found"
      body={`That ${what} does not exist.`}
      actionLabel="Back"
      actionIcon="arrow-left"
      actionTestID="not-found-back"
      onAction={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
      testID="not-found"
    />
  );
}
