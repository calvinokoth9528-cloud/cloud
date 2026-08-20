import { useMemo, useState } from 'react'
import ForecastChart from './components/ForecastChart.jsx'
import {
  forecast,
  metrics,
  parseSeries,
  sampleSeries,
  confidenceIntervals,
  backtest,
  compareModels,
  parseCSV,
} from './forecast.js'

const DEFAULT_TEXT = '10,12,11,14,13,16,15,18,17,20,19,22'

export default function App() {
  const [text, setText] = useState(DEFAULT_TEXT)
  const [method, setMethod] = useState('linear')
  const [horizon, setHorizon] = useState(12)
  const [windowSize, setWindowSize] = useState(4)
  const [alpha, setAlpha] = useState(0.4)
  const [beta, setBeta] = useState(0.1)
  const [gamma, setGamma] = useState(0.3)
  const [seasonLength, setSeasonLength] = useState(12)
  const [testSize, setTestSize] = useState(0)

  const series = useMemo(() => parseSeries(text), [text])

  const result = useMemo(
    () =>
      forecast(series, {
        method,
        horizon,
        window: windowSize,
        alpha,
        beta,
        gamma,
        seasonLength,
      }),
    [series, method, horizon, windowSize, alpha, beta, gamma, seasonLength],
  )

  const intervals = useMemo(
    () => confidenceIntervals(series, result.fit, result.forecast),
    [series, result],
  )

  const backtestResult = useMemo(
    () =>
      testSize > 0
        ? backtest(
            series,
            { method, horizon, window: windowSize, alpha, beta, gamma, seasonLength },
            testSize,
          )
        : null,
    [series, method, horizon, windowSize, alpha, beta, gamma, seasonLength, testSize],
  )

  const comparison = useMemo(
    () =>
      compareModels(series, {
        method,
        horizon,
        window: windowSize,
        alpha,
        beta,
        gamma,
        seasonLength,
        testSize,
      }),
    [series, method, horizon, windowSize, alpha, beta, gamma, seasonLength, testSize],
  )

  const chartData = useMemo(() => {
    const n = series.length
    const btStart = backtestResult ? n - backtestResult.testSize : -1
    const hist = series.map((v, i) => ({
      t: i,
      history: v,
      fit: result.fit[i] ?? null,
      forecast: i === n - 1 ? v : null,
      lower: i === n - 1 ? v : null,
      upper: i === n - 1 ? v : null,
      btForecast: backtestResult && i >= btStart ? backtestResult.pred[i - btStart] : null,
    }))
    const fc = result.forecast.map((v, h) => {
      const ci = intervals[h] || { lower: v, upper: v }
      return {
        t: n + h,
        history: null,
        fit: null,
        forecast: v,
        lower: ci.lower,
        upper: ci.upper,
        btForecast: null,
      }
    })
    return [...hist, ...fc]
  }, [series, result, intervals, backtestResult])

  const stats = useMemo(() => metrics(series, result.fit), [series, result])

  const loadSample = (kind) => setText(sampleSeries(kind).join(', '))

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const nums = parseCSV(String(reader.result))
      if (nums.length) setText(nums.join(', '))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExport = () => {
    const n = series.length
    const lines = ['t,type,value,lower,upper']
    series.forEach((v, i) => lines.push(`${i},history,${v}`))
    result.forecast.forEach((v, h) => {
      const ci = intervals[h] || { lower: '', upper: '' }
      lines.push(`${n + h},forecast,${v},${ci.lower ?? ''},${ci.upper ?? ''}`)
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'forecast.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Forecast Dashboard</h1>
          <p className="sub">Interactive time-series predictor</p>
        </div>
        <div className="sample-btns">
          <button onClick={() => loadSample('random')}>Random walk</button>
          <button onClick={() => loadSample('trend')}>Trend</button>
          <button onClick={() => loadSample('seasonal')}>Seasonal</button>
        </div>
      </header>

      <div className="grid">
        <aside className="panel controls">
          <h2>Data</h2>
          <label className="field">
            <span>Series (comma or space separated)</span>
            <textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. 10, 12, 11, 14, ..."
            />
          </label>
          <p className="hint">{series.length} data points</p>
          <div className="data-actions">
            <label className="file-btn">
              Import CSV
              <input type="file" accept=".csv,.txt" onChange={handleFile} hidden />
            </label>
            <button onClick={handleExport}>Export CSV</button>
          </div>

          <h2>Model</h2>
          <label className="field">
            <span>Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="linear">Linear Regression</option>
              <option value="ma">Moving Average</option>
              <option value="holt">Exponential Smoothing (Holt)</option>
              <option value="holtwinters">Holt-Winters (seasonal)</option>
            </select>
          </label>

          <label className="field">
            <span>Horizon: {horizon}</span>
            <input
              type="range"
              min={1}
              max={36}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            />
          </label>

          <label className="field">
            <span>Backtest holdout: {testSize === 0 ? 'off' : testSize}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, Math.min(24, Math.floor(series.length / 2) - 1))}
              value={testSize}
              onChange={(e) => setTestSize(Number(e.target.value))}
            />
          </label>

          {method === 'ma' && (
            <label className="field">
              <span>Window: {windowSize}</span>
              <input
                type="range"
                min={1}
                max={Math.max(1, series.length)}
                value={windowSize}
                onChange={(e) => setWindowSize(Number(e.target.value))}
              />
            </label>
          )}

          {method === 'holt' && (
            <>
              <label className="field">
                <span>Alpha (level): {alpha.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.05}
                  value={alpha}
                  onChange={(e) => setAlpha(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Beta (trend): {beta.toFixed(2)}</span>
                <input
                  type="range"
                  min={0}
                  max={0.9}
                  step={0.05}
                  value={beta}
                  onChange={(e) => setBeta(Number(e.target.value))}
                />
              </label>
            </>
          )}

          {method === 'holtwinters' && (
            <>
              <label className="field">
                <span>Season length: {seasonLength}</span>
                <input
                  type="range"
                  min={2}
                  max={Math.max(2, Math.floor(series.length / 2))}
                  value={seasonLength}
                  onChange={(e) => setSeasonLength(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Alpha (level): {alpha.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.05}
                  value={alpha}
                  onChange={(e) => setAlpha(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Beta (trend): {beta.toFixed(2)}</span>
                <input
                  type="range"
                  min={0}
                  max={0.9}
                  step={0.05}
                  value={beta}
                  onChange={(e) => setBeta(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Gamma (season): {gamma.toFixed(2)}</span>
                <input
                  type="range"
                  min={0}
                  max={0.95}
                  step={0.05}
                  value={gamma}
                  onChange={(e) => setGamma(Number(e.target.value))}
                />
              </label>
            </>
          )}

          <ModelExplainer
            method={method}
            windowSize={windowSize}
            alpha={alpha}
            beta={beta}
            gamma={gamma}
            seasonLength={seasonLength}
          />
        </aside>

        <main className="panel main">
          <div className="metrics">
            <Metric label="MAE" value={stats.mae} />
            <Metric label="RMSE" value={stats.rmse} />
            <Metric label="MAPE %" value={stats.mape} />
            <Metric label="Next value" value={result.forecast[0]} />
          </div>

          <div className="chart-wrap">
            <ForecastChart data={chartData} historyLen={series.length} />
          </div>

          {backtestResult && (
            <div className="panel-inner backtest">
              <h3>Backtest — held out last {backtestResult.testSize}</h3>
              <div className="mini-metrics">
                <Metric label="BT RMSE" value={backtestResult.rmse} />
                <Metric label="BT MAE" value={backtestResult.mae} />
              </div>
              <p className="hint">
                The cyan dashed line on the chart is the model&rsquo;s forecast over the withheld
                region, compared against the actuals (blue).
              </p>
            </div>
          )}

          <div className="forecast-table">
            <h3>Forecast</h3>
            <div className="chips">
              {result.forecast.map((v, h) => (
                <span className="chip" key={h}>
                  t+{h + 1}: <b>{v.toFixed(1)}</b>
                </span>
              ))}
            </div>
          </div>

          <div className="panel-inner comparison">
            <h3>
              Model comparison{' '}
              {testSize > 0 ? '(ranked by backtest RMSE)' : '(ranked by in-sample RMSE)'}
            </h3>
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>In-sample RMSE</th>
                  <th>Backtest RMSE</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((r) => (
                  <tr key={r.method} className={r.best ? 'best' : ''}>
                    <td>
                      {r.label}
                      {r.best ? ' ★' : ''}
                    </td>
                    <td>{r.inSampleRMSE.toFixed(2)}</td>
                    <td>{r.backtestRMSE == null ? '—' : r.backtestRMSE.toFixed(2)}</td>
                    <td>
                      <button onClick={() => setMethod(r.method)}>Use</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <GraphExplainer
            series={series}
            result={result}
            intervals={intervals}
            horizon={horizon}
          />
        </main>
      </div>
    </div>
  )
}

function ModelExplainer({ method, windowSize, alpha, beta, gamma, seasonLength }) {
  const content = {
    linear: {
      title: 'Linear Regression',
      body: [
        'Fits a straight line y = m·x + b to the history using ordinary least squares, where x is the time index.',
        'It then extrapolates that same line forward for the horizon, so the forecast is a straight continuation of the trend.',
        'Best for data with a steady up/down trend and no seasonality. The green "Fit" line shows the line over history; MAE/RMSE measure how far the fit is from the actual values.',
      ],
    },
    ma: {
      title: 'Moving Average',
      body: [
        `Averages the last ${windowSize} observations and projects that single value forward for every future step (a flat forecast).`,
        'It only reacts to the recent level, not the direction. Larger windows smooth noise but lag behind trends; smaller windows react faster but are noisier.',
        'Best for stable, noisy series with no clear trend.',
      ],
    },
    holt: {
      title: 'Exponential Smoothing (Holt)',
      body: [
        'Smooths the series with a level and a trend component. Forecast = last level + h × last trend, so it can project both the level and the direction.',
        `Level α = ${alpha.toFixed(2)} controls how fast it learns the current value; trend β = ${beta.toFixed(2)} controls how fast it adapts the slope.`,
        'Values near 1 react quickly to recent changes; values near 0 hold steadier. Best for series with a trend but no strong seasonality.',
      ],
    },
    holtwinters: {
      title: 'Holt-Winters (seasonal)',
      body: [
        `Extends Holt with a repeating seasonal component of length ${seasonLength}. Forecast = level + h × trend + seasonal[h].`,
        `Level α = ${alpha.toFixed(2)}, trend β = ${beta.toFixed(2)}, season γ = ${gamma.toFixed(2)} weight how fast each component adapts to new data.`,
        'Best for series with both a trend and a repeating cycle (e.g. monthly sales). Needs at least ~2 full cycles of history to estimate the season.',
      ],
    },
  }
  const c = content[method]
  return (
    <div className="explainer">
      <h2>How it works</h2>
      <h3>{c.title}</h3>
      <ul>
        {c.body.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
        <li>
          The shaded orange band is the <b>95% prediction interval</b>: it is built from the
          in-sample residuals (σ) and widens with the square root of the horizon
          (±1.96·σ·√(h+1)), so nearer steps are tighter than distant ones.
        </li>
      </ul>
    </div>
  )
}

function GraphExplainer({ series, result, intervals, horizon }) {
  const n = series.length
  const first = series[0]
  const last = series[n - 1]
  const next = result.forecast[0]
  const lastFc = result.forecast[result.forecast.length - 1]
  const endIdx = n - 1 + horizon
  const far = intervals[intervals.length - 1] || { lower: lastFc, upper: lastFc }
  const half = (far.upper - far.lower) / 2

  const items = [
    {
      color: '#4f8cff',
      label: 'History',
      text:
        n > 0
          ? `Your ${n} entered values, from ${first.toFixed(1)} at t=0 to ${last.toFixed(
              1,
            )} at t=${n - 1}.`
          : 'No data entered yet.',
    },
    {
      color: '#46d39a',
      label: 'Fit',
      dashed: true,
      text: 'The model\u2019s fitted line over the history (in-sample). It is the basis for the MAE / RMSE / MAPE error metrics.',
    },
    {
      color: '#ff8c42',
      label: 'Forecast',
      dashed: true,
      text:
        horizon > 0
          ? `The next ${horizon} predicted steps, starting at ${next.toFixed(1)} (t=${n}) and ending at ${lastFc.toFixed(
              1,
            )} (t=${endIdx}).`
          : 'Set a horizon greater than 0 to see predictions.',
    },
    {
      color: '#ff8c42',
      label: '95% interval',
      band: true,
      text: `The expected range around the forecast. At the furthest step it spans ±${half.toFixed(
        1,
      )} (from ${far.lower.toFixed(1)} to ${far.upper.toFixed(1)}), widening with the horizon.`,
    },
    {
      color: '#5b647a',
      label: 'Boundary',
      dashed: true,
      text: `The vertical dashed line marks t=${n - 1}: everything to the left is observed history, everything to the right is predicted.`,
    },
  ]

  return (
    <div className="graph-explain">
      <h3>Reading this graph</h3>
      <ul>
        {items.map((it) => (
          <li key={it.label}>
            <span
              className={`swatch${it.dashed ? ' dashed' : ''}${it.band ? ' band' : ''}`}
              style={{
                background: it.band ? 'transparent' : it.color,
                borderColor: it.color,
                color: it.color,
              }}
            />
            <span className="g-label">{it.label}:</span> {it.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Metric({ label, value }) {
  const display = value == null || Number.isNaN(value) ? '—' : value.toFixed(2)
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{display}</span>
    </div>
  )
}
