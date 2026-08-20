import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts'

export default function ForecastChart({ data, historyLen }) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
        <XAxis dataKey="t" stroke="#8b93a7" fontSize={12} />
        <YAxis stroke="#8b93a7" fontSize={12} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{
            background: '#1b2030',
            border: '1px solid #2a3142',
            color: '#e6e9f0',
            borderRadius: 8,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {historyLen > 0 && (
          <ReferenceLine x={historyLen - 1} stroke="#5b647a" strokeDasharray="4 4" />
        )}
        <Line
          name="History"
          type="monotone"
          dataKey="history"
          stroke="#4f8cff"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          name="Upper 95%"
          type="monotone"
          dataKey="upper"
          stroke="#ff8c42"
          strokeWidth={1}
          strokeOpacity={0.5}
          strokeDasharray="2 3"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          name="Backtest"
          type="monotone"
          dataKey="btForecast"
          stroke="#22d3ee"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          name="Forecast"
          type="monotone"
          dataKey="forecast"
          stroke="#ff8c42"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          name="Lower 95%"
          type="monotone"
          dataKey="lower"
          stroke="#ff8c42"
          strokeWidth={1}
          strokeOpacity={0.5}
          strokeDasharray="2 3"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          name="Fit"
          type="monotone"
          dataKey="fit"
          stroke="#46d39a"
          strokeWidth={1.5}
          strokeDasharray="2 3"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
