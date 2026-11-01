import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo, Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Tone = "info" | "success" | "error";
type ShowOptions = { tone?: Tone; durationMs?: number };
type ToastApi = { show: (message: string, opts?: ShowOptions) => void };

const ToastContext = createContext<ToastApi | null>(null);

const toneClasses: Record<Tone, string> = {
  info: "bg-primary",
  success: "bg-correct",
  error: "bg-wrong",
};

type Current = { id: number; message: string; tone: Tone; durationMs: number };

// One toast at a time: a new message replaces the old one. Sits `bottomOffset` plus the bottom
// safe area above the screen edge, which clears the tab bar.
export function ToastProvider({
  children,
  bottomOffset = 72,
}: {
  children: ReactNode;
  bottomOffset?: number;
}) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<Current>();
  const [opacity] = useState(() => new Animated.Value(0));
  const nextId = useRef(0);

  const show = useCallback((message: string, opts?: ShowOptions) => {
    nextId.current += 1;
    setCurrent({
      id: nextId.current,
      message,
      tone: opts?.tone ?? "info",
      durationMs: opts?.durationMs ?? 3000,
    });
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  useEffect(() => {
    if (!current) return;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setCurrent((c) => (c?.id === current.id ? undefined : c));
        },
      );
    }, current.durationMs);
    return () => clearTimeout(timer);
  }, [current, opacity]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          className="absolute left-4 right-4"
          style={{ bottom: bottomOffset + insets.bottom, opacity }}
        >
          <View className="flex-row overflow-hidden rounded-md bg-surface shadow-md dark:border dark:border-border">
            <View className={`w-1 ${toneClasses[current.tone]}`} />
            <Text className="flex-1 px-4 py-3 text-base text-text">{current.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside a ToastProvider");
  return api;
}
