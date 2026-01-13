'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface CategoryPieChartProps {
  data: { name: string; value: number }[]
}

// Modern color palette that works well on both light and dark backgrounds
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

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) =>
            (percent ?? 0) > 0.05 ? `${name} (${((percent ?? 0) * 100).toFixed(0)}%)` : ''
          }
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
          }}
          formatter={(value) => [`฿${(value ?? 0).toLocaleString()}`, 'มูลค่า']}
          itemStyle={{ color: 'var(--text-primary)' }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
