import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';
import { useHabitStore } from '../../stores/habitStore';

export const WeeklyBarChart = () => {
  // Mock data: completions per day of the current week
  const data = [
    { day: 'M', count: 3 },
    { day: 'T', count: 5 },
    { day: 'W', count: 2 },
    { day: 'T', count: 6 },
    { day: 'F', count: 4 },
    { day: 'S', count: 7 },
    { day: 'S', count: 1 },
  ];

  return (
    <View style={styles.container}>
      <CartesianChart 
        data={data} 
        xKey="day" 
        yKeys={["count"]} 
        domainPadding={{ left: 20, right: 20, top: 10, bottom: 0 }}
      >
        {({ points, chartBounds }) => (
          <Bar
            chartBounds={chartBounds}
            points={points.count}
            roundedCorners={{
              topLeft: 8,
              topRight: 8,
            }}
            barWidth={20}
            color="#10B981" // Success/Secondary fill
          />
        )}
      </CartesianChart>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 200,
    width: '100%',
  }
});
