import React, { useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { Canvas, RoundedRect, rect, rrect } from '@shopify/react-native-skia';
import { useHabitStore } from '../../stores/habitStore';

const WEEKS = 52;
const DAYS = 7;
const CELL_SIZE = 10;
const CELL_GAP = 2;

export const ContributionHeatmap = () => {
  const { completions } = useHabitStore();

  const heatmapData = useMemo(() => {
    // Generate mock/real data for 52 weeks
    // For now, randomly fill a few cells to show the UI
    const grid: number[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      const week: number[] = [];
      for (let d = 0; d < DAYS; d++) {
        // Random completion value between 0 and 1
        week.push(Math.random() > 0.8 ? Math.random() : 0);
      }
      grid.push(week);
    }
    return grid;
  }, [completions]);

  const width = WEEKS * (CELL_SIZE + CELL_GAP);
  const height = DAYS * (CELL_SIZE + CELL_GAP);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width, height, padding: 10 }}>
        <Canvas style={{ flex: 1 }}>
          {heatmapData.map((week, w) =>
            week.map((val, d) => {
              const x = w * (CELL_SIZE + CELL_GAP);
              const y = d * (CELL_SIZE + CELL_GAP);
              
              const rectConfig = rrect(rect(x, y, CELL_SIZE, CELL_SIZE), 2, 2);
              
              // Base color vs filled color
              const color = val === 0 ? 'rgba(255,255,255,0.06)' : `rgba(124, 58, 237, ${0.4 + val * 0.6})`;
              
              return (
                <RoundedRect key={`${w}-${d}`} rect={rectConfig} color={color} />
              );
            })
          )}
        </Canvas>
      </View>
    </ScrollView>
  );
};
