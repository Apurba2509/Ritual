import React, { forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface BottomSheetRef {
  expand: () => void;
  close: () => void;
}

interface BottomSheetProps {
  children: React.ReactNode;
  snapPoints?: string[]; // e.g. ['50%', '90%']
  onClose?: () => void;
}

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  ({ children, snapPoints = ['50%'], onClose }, ref) => {
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const context = useSharedValue({ y: 0 });

    const getSnapHeight = (point: string) => {
      const percentage = parseFloat(point) / 100;
      return SCREEN_HEIGHT - SCREEN_HEIGHT * percentage;
    };

    const minSnapPoint = getSnapHeight(snapPoints[snapPoints.length - 1] || '50%');
    const maxSnapPoint = SCREEN_HEIGHT;

    const scrollTo = (destination: number) => {
      'worklet';
      translateY.value = withSpring(destination, { damping: 50, stiffness: 200 });
      if (destination === maxSnapPoint && onClose) {
        runOnJS(onClose)();
      }
    };

    useImperativeHandle(ref, () => ({
      expand: () => {
        scrollTo(minSnapPoint);
      },
      close: () => {
        scrollTo(maxSnapPoint);
      },
    }), [minSnapPoint]);

    const gesture = Gesture.Pan()
      .onStart(() => {
        context.value = { y: translateY.value };
      })
      .onUpdate((event) => {
        translateY.value = Math.max(context.value.y + event.translationY, minSnapPoint);
      })
      .onEnd((event) => {
        if (event.velocityY > 500 || event.translationY > 100) {
          scrollTo(maxSnapPoint); // Close
        } else {
          scrollTo(minSnapPoint); // Snap back
        }
      });

    const rBottomSheetStyle = useAnimatedStyle(() => {
      return {
        transform: [{ translateY: translateY.value }],
      };
    });

    const rBackdropStyle = useAnimatedStyle(() => {
      return {
        opacity: withTiming(translateY.value === maxSnapPoint ? 0 : 1),
        pointerEvents: translateY.value === maxSnapPoint ? 'none' : 'auto',
      } as any;
    });

    return (
      <>
        <Animated.View style={[styles.backdrop, rBackdropStyle]} onTouchStart={() => scrollTo(maxSnapPoint)} />
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.bottomSheetContainer, rBottomSheetStyle]}>
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
            <View style={styles.contentContainer}>
              {children}
            </View>
          </Animated.View>
        </GestureDetector>
      </>
    );
  }
);

const styles = StyleSheet.create({
  backdrop: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  bottomSheetContainer: {
    height: SCREEN_HEIGHT,
    width: '100%',
    backgroundColor: '#151720', // slightly lighter than background
    position: 'absolute',
    top: 0,
    zIndex: 101,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    borderColor: 'rgba(255,255,255,0.05)',
    borderTopWidth: 1,
  },
  handleContainer: {
    width: '100%',
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
});
