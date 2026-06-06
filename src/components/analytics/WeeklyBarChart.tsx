import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';
import { parseISO, isSameDay, subDays, startOfDay } from 'date-fns';

export const WeeklyBarChart = ({ completions = [] }: { completions?: any[] }) => {
  const data = useMemo(() => {
    const today = startOfDay(new Date());
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const currentDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0 is Monday, 6 is Sunday
    
    // Generate the last 7 days ending today
    const weekData = Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(today, 6 - i);
      const dayLabel = days[date.getDay() === 0 ? 6 : date.getDay() - 1];
      
      const count = completions.filter(c => isSameDay(parseISO(c.completed_at), date)).length;
      return { day: dayLabel, count };
    });
    
    return weekData;
  }, [completions]);

  const maxCount = Math.max(...data.map(d => d.count), 5); // Ensure Y-axis goes up to at least 5

  return (
    <View style={styles.container}>
      <CartesianChart 
        data={data} 
        xKey="day" 
        yKeys={["count"]} 
        domain={{ y: [0, maxCount] }}
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
            color="#7C3AED" // Primary purple instead of green
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
