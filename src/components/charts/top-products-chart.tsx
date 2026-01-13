'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface TopProductsChartProps {
  data: { name: string; qty: number }[]
}

// Modern color palette
const COLORS = [
  '#60a5fa', // blue
  '#34d399', // emerald
  '#f472b6', // pink
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#fb7185', // rose
  '#38bdf8', // sky
  '#4ade80', // green
  '#f97316', // orange
  '#c084fc', // purple
]

export function TopProductsChart({ data }: TopProductsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border-default)]" horizontal={false} />
        <XAxis 
          type="number" 
          className="text-[var(--text-muted)]" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
        />
        <YAxis
          type="category"
          dataKey="name"
          className="text-[var(--text-muted)]"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={120}
          tickFormatter={(value) => (value.length > 15 ? value.slice(0, 15) + '...' : value)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
          }}
          formatter={(value) => [(value ?? 0).toLocaleString(), 'จำนวน']}
          labelStyle={{ color: 'var(--text-secondary)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
        />
        <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
