'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface StockValueChartProps {
  data: { date: string; value: number }[]
}

export function StockValueChart({ data }: StockValueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border-default)]" />
        <XAxis
          dataKey="date"
          className="text-[var(--text-muted)]"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          className="text-[var(--text-muted)]"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
          }}
          formatter={(value) => [`฿${(value ?? 0).toLocaleString()}`, 'มูลค่า']}
          labelStyle={{ color: 'var(--text-secondary)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--accent-primary)"
          strokeWidth={2}
          dot={{ fill: 'var(--accent-primary)', strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, fill: 'var(--accent-primary)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
