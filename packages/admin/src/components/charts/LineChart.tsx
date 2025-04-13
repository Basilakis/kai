import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface LineChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  color: string;
}

/**
 * LineChart Component
 * 
 * A wrapper around Recharts LineChart for displaying time series data.
 */
const LineChart: React.FC<LineChartProps> = ({ data, xKey, yKey, color }) => {
  // Format timestamp for display
  const formatXAxis = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsLineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey={xKey} 
          tickFormatter={formatXAxis} 
          label={{ value: 'Time', position: 'insideBottomRight', offset: -10 }} 
        />
        <YAxis 
          label={{ value: yKey.charAt(0).toUpperCase() + yKey.slice(1), angle: -90, position: 'insideLeft' }} 
        />
        <Tooltip 
          labelFormatter={(label) => new Date(label).toLocaleString()}
          formatter={(value) => [value.toFixed(4), yKey.charAt(0).toUpperCase() + yKey.slice(1)]}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey={yKey} 
          stroke={color} 
          activeDot={{ r: 8 }} 
          dot={{ r: 3 }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
};

export default LineChart;
