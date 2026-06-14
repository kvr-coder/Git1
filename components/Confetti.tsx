// One-shot confetti burst, mounted briefly on Approve actions.
// Uses lottie-react-native (native module — requires a rebuild, not OTA).
import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export function Confetti({ trigger }: { trigger: number }) {
  const ref = useRef<LottieView>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1400);
    return () => clearTimeout(t);
  }, [trigger]);

  useEffect(() => {
    if (show) ref.current?.play(0, 80);
  }, [show]);

  if (!show) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <LottieView
        ref={ref}
        source={require('../assets/lottie/confetti.json')}
        autoPlay
        loop={false}
        style={styles.anim}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  anim: { width: 360, height: 360 },
});
