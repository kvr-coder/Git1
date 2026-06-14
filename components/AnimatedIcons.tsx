// Animated icons used throughout the app.
//
// Lottie icons (hourglass, wave, loading dots, padlock open/close) ship inside
// the native bundle but the JSON files themselves can be updated via OTA, so
// future tweaks land without a rebuild.
//
// Bell + status pulse use the built-in Animated API so they work without
// Lottie installed and can ship via OTA on day one.

import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

// ─── Lottie wrappers ────────────────────────────────────────

export function HourglassIcon({ size = 56 }: { size?: number }) {
  return (
    <LottieView
      autoPlay
      loop
      source={require('../assets/lottie/hourglass.json')}
      style={{ width: size, height: size }}
    />
  );
}

export function WaveIcon({ size = 96 }: { size?: number }) {
  return (
    <LottieView
      autoPlay
      loop
      source={require('../assets/lottie/wave.json')}
      style={{ width: size, height: size }}
    />
  );
}

export function LoadingDots({ size = 70 }: { size?: number }) {
  return (
    <LottieView
      autoPlay
      loop
      source={require('../assets/lottie/loading.json')}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Plays once when `open` flips. Open = unlocked, closed = locked.
 * We play one shot in the right direction by re-mounting the LottieView.
 */
export function PadlockIcon({ size = 36, open }: { size?: number; open: boolean }) {
  // Re-mount on state change so the play state resets cleanly.
  return (
    <View key={String(open)} style={{ width: size, height: size }}>
      <LottieView
        autoPlay
        loop={false}
        speed={open ? 1 : -1}
        source={require('../assets/lottie/padlock.json')}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

// ─── Animated-API icons (no native module needed) ───────────

/** Bell that rings (shakes) whenever `trigger` changes to a truthy number. */
export function RingingBell({
  size = 22,
  color,
  trigger,
}: {
  size?: number;
  color: string;
  trigger: number;
}) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!trigger) return;
    Animated.sequence([
      Animated.timing(rot, { toValue: 1, duration: 80, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(rot, { toValue: -1, duration: 120, useNativeDriver: true, easing: Easing.inOut(Easing.cubic) }),
      Animated.timing(rot, { toValue: 1, duration: 120, useNativeDriver: true, easing: Easing.inOut(Easing.cubic) }),
      Animated.timing(rot, { toValue: -0.7, duration: 100, useNativeDriver: true }),
      Animated.timing(rot, { toValue: 0.7, duration: 100, useNativeDriver: true }),
      Animated.timing(rot, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [trigger, rot]);
  const deg = rot.interpolate({ inputRange: [-1, 1], outputRange: ['-20deg', '20deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate: deg }] }}>
      <Ionicons name={trigger ? 'notifications' : 'notifications-outline'} size={size} color={color} />
    </Animated.View>
  );
}

// ─── More Lottie wrappers ──────────────────────────────────

export function CalendarIcon({ size = 28 }: { size?: number }) {
  return <LottieView autoPlay loop source={require('../assets/lottie/calendar.json')} style={{ width: size, height: size }} />;
}
export function GearIcon({ size = 28 }: { size?: number }) {
  return <LottieView autoPlay loop source={require('../assets/lottie/gear.json')} style={{ width: size, height: size }} />;
}
export function PulseLineIcon({ size = 28 }: { size?: number }) {
  return <LottieView autoPlay loop source={require('../assets/lottie/pulse.json')} style={{ width: size, height: size }} />;
}
export function StarIcon({ size = 28 }: { size?: number }) {
  return <LottieView autoPlay loop source={require('../assets/lottie/star.json')} style={{ width: size, height: size }} />;
}
export function CoinIcon({ size = 28 }: { size?: number }) {
  return <LottieView autoPlay loop source={require('../assets/lottie/coin.json')} style={{ width: size, height: size }} />;
}
export function HomeIcon({ size = 28 }: { size?: number }) {
  return <LottieView autoPlay loop source={require('../assets/lottie/home.json')} style={{ width: size, height: size }} />;
}
export function LaptopIcon({ size = 28 }: { size?: number }) {
  return <LottieView autoPlay loop source={require('../assets/lottie/laptop.json')} style={{ width: size, height: size }} />;
}
export function DesktopIcon({ size = 28 }: { size?: number }) {
  return <LottieView autoPlay loop source={require('../assets/lottie/desktop.json')} style={{ width: size, height: size }} />;
}
/** One-shot check that draws itself when `trigger` increments. */
export function CheckBurst({ size = 28, trigger }: { size?: number; trigger: number }) {
  return (
    <View key={trigger} style={{ width: size, height: size }}>
      <LottieView autoPlay loop={false} source={require('../assets/lottie/check.json')} style={{ width: size, height: size }} />
    </View>
  );
}

/** Subtle "breathing" pulse on the online status dot. */
export function HeartbeatDot({ size = 8, color }: { size?: number; color: string }) {
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(s, { toValue: 1.25, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(s, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      ]),
    ).start();
  }, [s]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ scale: s }],
      }}
    />
  );
}
