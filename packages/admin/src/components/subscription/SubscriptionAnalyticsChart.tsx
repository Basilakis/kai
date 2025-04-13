import React from 'react';
import { Box, useTheme } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface TierDistribution {
  name: string;
  count: number;
  revenue: number;
  percentage: number;
}

interface SubscriptionAnalyticsChartProps {
  data: TierDistribution[];
  chartType?: 'bar' | 'pie';
}

const SubscriptionAnalyticsChart: React.FC<SubscriptionAnalyticsChartProps> = ({
  data,
  chartType = 'bar'
}) => {
  const theme = useTheme();
  
  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main
  ];
  
  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis yAxisId="left" orientation="left" stroke={theme.palette.primary.main} />
        <YAxis yAxisId="right" orientation="right" stroke={theme.palette.secondary.main} />
        <Tooltip 
          formatter={(value, name) => {
            if (name === 'revenue') {
              return [`$${value}`, 'Revenue'];
            }
            return [value, name === 'count' ? 'Subscribers' : name];
          }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="count" name="Subscribers" fill={theme.palette.primary.main} />
        <Bar yAxisId="right" dataKey="revenue" name="Revenue" fill={theme.palette.secondary.main} />
      </BarChart>
    </ResponsiveContainer>
  );
  
  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={true}
          outerRadius={100}
          fill="#8884d8"
          dataKey="count"
          nameKey="name"
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value, name, props) => {
            return [`${value} subscribers (${(props.payload.percentage * 100).toFixed(2)}%)`, props.payload.name];
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
  
  return (
    <Box>
      {chartType === 'bar' ? renderBarChart() : renderPieChart()}
    </Box>
  );
};

export default SubscriptionAnalyticsChart;
