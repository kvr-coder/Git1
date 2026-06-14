// Built-in Animated-API primitives. No native modules => fully OTA-safe.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { radius } from '../lib/theme';

// ───────────────────────────────────────────────────────────
// PulseDot — soft "I'm alive" pulse for online status.
// ───────────────────────────────────────────────────────────
export function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 2.4, duration: 1100, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.85, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
          { transform: [{ scale }], opacity },
        ]}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// AnimatedNumber — smoothly tween a numeric value when it changes.
// ───────────────────────────────────────────────────────────
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toString(),
  style,
}: {
  value: number;
  format?: (n: number) => string;
  style?: any;
}) {
  const anim = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState<string>(format(value));
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(format(v)));
    Animated.timing(anim, {
      toValue: value,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, anim, format]);
  return <Animated.Text style={style}>{display}</Animated.Text>;
}

// ───────────────────────────────────────────────────────────
// AnimatedBar — spring-animated horizontal bar.
// Colour transitions green → amber → red automatically.
// ───────────────────────────────────────────────────────────
export function AnimatedBar({
  pct,
  height = 10,
  track,
  green,
  amber,
  red,
}: {
  pct: number;
  height?: number;
  track: string;
  green: string;
  amber: string;
  red: string;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  const width = useRef(new Animated.Value(clamped)).current;
  useEffect(() => {
    Animated.spring(width, { toValue: clamped, useNativeDriver: false, friction: 9, tension: 60 }).start();
  }, [clamped, width]);
  const fill = clamped >= 1 ? red : clamped >= 0.8 ? amber : green;
  const widthInterp = width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ width: '100%', height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={{ width: widthInterp, height: '100%', backgroundColor: fill, borderRadius: height }} />
    </View>
  );
}

// ───────────────────────────────────────────────────────────
// SpinIcon — rotates an icon. Use loop={true} for "refreshing".
// ───────────────────────────────────────────────────────────
export function SpinIcon({
  name,
  color,
  size = 18,
  loop = false,
  trigger = 0,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
  loop?: boolean;
  /** Bumping this triggers a single spin. */
  trigger?: number;
}) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (loop) {
      Animated.loop(
        Animated.timing(rot, { toValue: 1, duration: 1100, useNativeDriver: true, easing: Easing.linear }),
      ).start();
    }
  }, [loop, rot]);
  useEffect(() => {
    if (!loop) {
      rot.setValue(0);
      Animated.timing(rot, { toValue: 1, duration: 350, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
    }
  }, [trigger, loop, rot]);
  const deg = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate: deg }] }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

// ───────────────────────────────────────────────────────────
// BounceIn — gentle scale-in for elements that just appeared/changed.
// ───────────────────────────────────────────────────────────
export function BounceIn({
  trigger,
  children,
  style,
}: {
  trigger: any;
  children: React.ReactNode;
  style?: any;
}) {
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    s.setValue(0.85);
    Animated.spring(s, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [trigger, s]);
  return <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>;
}

// ───────────────────────────────────────────────────────────
// PressableScale — wrap a Pressable to scale-down on touch.
// ───────────────────────────────────────────────────────────
export function PressableScale({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: any }) {
  const s = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[style, { transform: [{ scale: s }] }]}>
      <View
        onTouchStart={() => Animated.spring(s, { toValue: 0.97, useNativeDriver: true, friction: 7 }).start()}
        onTouchEnd={() => {
          Animated.spring(s, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
          onPress?.();
        }}
        onTouchCancel={() => Animated.spring(s, { toValue: 1, useNativeDriver: true, friction: 5 }).start()}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const _s = StyleSheet.create({ _: { borderRadius: radius.sm } });
