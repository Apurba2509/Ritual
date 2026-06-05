import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

// Simple placeholder for icons. We can integrate expo-symbols or equivalent later.
const getIconName = (routeName: string) => {
  switch (routeName) {
    case 'index':
      return 'Today';
    case 'analytics':
      return 'Stats';
    case 'social':
      return 'Social';
    case 'profile':
      return 'Profile';
    default:
      return 'Tab';
  }
};

export const TabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const { width } = Dimensions.get('window');
  const TAB_WIDTH = width / state.routes.length;

  // Animated style for the sliding indicator pill
  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: withSpring(state.index * TAB_WIDTH, { damping: 20, stiffness: 200 }) }],
      width: TAB_WIDTH,
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.indicatorContainer, indicatorStyle]}>
        <View style={styles.indicatorPill} />
      </Animated.View>

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={1}
          >
            <Text
              style={[
                styles.tabText,
                { color: isFocused ? '#FFFFFF' : '#9CA3AF' },
              ]}
              className="font-stat"
            >
              {getIconName(route.name)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 80,
    backgroundColor: 'rgba(20, 22, 32, 0.85)', // frosted background
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20, // safe area spacing approx
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  tabText: {
    marginTop: 4,
  },
  indicatorContainer: {
    position: 'absolute',
    top: 10,
    bottom: 20,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorPill: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(124, 58, 237, 0.2)', // primary color at 20% opacity
  },
});
