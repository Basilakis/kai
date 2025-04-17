import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface BarChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  color: string;
  label?: string;
}

/**
 * BarChart Component
 * 
 * A wrapper around Recharts BarChart for displaying categorical data,
 * particularly useful for class distribution in datasets.
 */
const BarChart: React.FC<BarChartProps> = ({ data, xKey, yKey, color, label }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsBarChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey={xKey} 
          label={{ value: label || xKey, position: 'insideBottomRight', offset: -10 }} 
        />
        <YAxis 
          label={{ value: 'Count', angle: -90, position: 'insideLeft' }} 
        />
        <Tooltip 
          formatter={(value: number) => [value, yKey.charAt(0).toUpperCase() + yKey.slice(1)]}
        />
        <Legend />
        <Bar 
          dataKey={yKey} 
          fill={color}
          name={yKey.charAt(0).toUpperCase() + yKey.slice(1)}
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};

export default BarChart;