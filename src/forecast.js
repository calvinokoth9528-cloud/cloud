// Pure forecasting functions. Input: number[] (historical y). Output: ForecastResult.

export function linearRegressionForecast(series, horizon) {
  const n = series.length
  const xs = series.map((_, i) => i)
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = series.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (series[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = meanY - slope * meanX
  const fit = series.map((_, i) => intercept + slope * i)
  const forecast = []
  for (let h = 1; h <= horizon; h++) {
    forecast.push(intercept + slope * (n - 1 + h))
  }
  return { fit, forecast, params: { slope, intercept } }
}

export function movingAverageForecast(series, horizon, window) {
  const w = Math.max(1, Math.min(window, series.length))
  const last = series.slice(series.length - w)
  const avg = last.reduce((a, b) => a + b, 0) / w
  const fit = series.map((_, i) => (i < series.length - w ? null : avg))
  const forecast = Array.from({ length: horizon }, () => avg)
  return { fit, forecast, params: { window: w, value: avg } }
}

export function holtForecast(series, horizon, alpha, beta) {
  const n = series.length
  let level = series[0]
  let trend = series.length > 1 ? series[1] - series[0] : 0
  const fit = [series[0]]
  for (let i = 1; i < n; i++) {
    const prevLevel = level
    level = alpha * series[i] + (1 - alpha) * (prevLevel + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
    fit.push(prevLevel + trend)
  }
  const fitOut = series.map((_, i) => fit[i])
  const forecast = []
  for (let h = 1; h <= horizon; h++) {
    forecast.push(level + h * trend)
  }
  return { fit: fitOut, forecast, params: { level, trend } }
}

export function holtWintersForecast(series, horizon, alpha, beta, gamma, seasonLength) {
  const n = series.length
  let m = Math.max(2, Math.min(Math.floor(seasonLength), Math.floor(n / 2)))
  if (!Number.isFinite(m) || m < 2) {
    return linearRegressionForecast(series, horizon)
  }

  const firstPeriod = series.slice(0, m)
  const level0 = firstPeriod.reduce((a, b) => a + b, 0) / m
  const second = series.slice(m, 2 * m)
  const level1 = second.length ? second.reduce((a, b) => a + b, 0) / second.length : level0
  const trend0 = (level1 - level0) / m

  const seas = firstPeriod.map((v) => v - level0)

  let level = level0
  let trend = trend0
  const fit = new Array(n).fill(null)

  for (let t = 1; t < n; t++) {
    const s = t % m
    fit[t] = level + trend + seas[s]
    const prevLevel = level
    level = alpha * (series[t] - seas[s]) + (1 - alpha) * (prevLevel + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
    seas[s] = gamma * (series[t] - level) + (1 - gamma) * seas[s]
  }

  const forecast = []
  for (let h = 1; h <= horizon; h++) {
    const idx = n - 1 + h
    const s = idx % m
    forecast.push(level + h * trend + seas[s])
  }
  return { fit, forecast, params: { level, trend, seasonLength: m } }
}

export function confidenceIntervals(series, fit, forecast, z = 1.96) {
  const resid = []
  for (let i = 0; i < series.length; i++) {
    const f = fit[i]
    if (f != null && !Number.isNaN(f)) resid.push(series[i] - f)
  }
  const k = resid.length
  if (k < 2) {
    return forecast.map(() => ({ lower: null, upper: null }))
  }
  const mean = resid.reduce((a, b) => a + b, 0) / k
  const variance = resid.reduce((a, b) => a + (b - mean) ** 2, 0) / (k - 1)
  const sigma = Math.sqrt(variance)
  return forecast.map((v, h) => {
    const half = z * sigma * Math.sqrt(h + 1)
    return { lower: v - half, upper: v + half }
  })
}

export function forecast(series, { method, horizon, window, alpha, beta, gamma, seasonLength }) {
  if (!series || series.length === 0) {
    return { fit: [], forecast: Array.from({ length: horizon }, () => 0), params: {} }
  }
  switch (method) {
    case 'ma':
      return movingAverageForecast(series, horizon, window)
    case 'holt':
      return holtForecast(series, horizon, alpha, beta)
    case 'holtwinters':
      return holtWintersForecast(series, horizon, alpha, beta, gamma, seasonLength)
    case 'linear':
    default:
      return linearRegressionForecast(series, horizon)
  }
}

export function metrics(series, fit) {
  const paired = series.map((y, i) => ({ y, f: fit[i] })).filter((d) => d.f != null && !Number.isNaN(d.f))
  if (paired.length === 0) return { mae: 0, rmse: 0, mape: 0 }
  let mae = 0
  let se = 0
  let mape = 0
  for (const { y, f } of paired) {
    const e = f - y
    mae += Math.abs(e)
    se += e * e
    if (y !== 0) mape += Math.abs(e / y)
  }
  const k = paired.length
  return {
    mae: mae / k,
    rmse: Math.sqrt(se / k),
    mape: (mape / k) * 100,
  }
}

export function backtest(series, options, testSize) {
  const n = series.length
  if (!testSize || testSize < 1) return null
  const trainLen = n - testSize
  if (trainLen < 5) return null
  const train = series.slice(0, trainLen)
  const test = series.slice(trainLen)
  const res = forecast(train, { ...options, horizon: testSize })
  const pred = res.forecast
  if (!pred || pred.length < testSize) return null
  let mae = 0
  let se = 0
  for (let i = 0; i < testSize; i++) {
    const e = pred[i] - test[i]
    mae += Math.abs(e)
    se += e * e
  }
  return {
    testSize,
    test,
    pred: pred.slice(0, testSize),
    mae: mae / testSize,
    rmse: Math.sqrt(se / testSize),
  }
}

export const METHOD_LABELS = {
  linear: 'Linear Regression',
  ma: 'Moving Average',
  holt: 'Holt',
  holtwinters: 'Holt-Winters',
}

export function compareModels(series, options) {
  const methods = ['linear', 'ma', 'holt', 'holtwinters']
  const testSize = options.testSize || 0
  const rows = methods.map((method) => {
    const opts = { ...options, method, horizon: testSize || options.horizon }
    const res = forecast(series, opts)
    const inS = metrics(series, res.fit)
    const bt = testSize > 0 ? backtest(series, { ...options, method }, testSize) : null
    const score = bt ? bt.rmse : inS.rmse
    return {
      method,
      label: METHOD_LABELS[method],
      inSampleRMSE: inS.rmse,
      backtestRMSE: bt ? bt.rmse : null,
      score,
    }
  })
  rows.sort((a, b) => a.score - b.score)
  rows.forEach((r, i) => {
    r.best = i === 0
  })
  return rows
}

export function parseCSV(text) {
  const lines = text.split(/\r?\n/)
  const out = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(',')
    const cell = parts.length > 1 ? parts[parts.length - 1].trim() : trimmed
    const num = Number(cell)
    if (!Number.isNaN(num)) out.push(num)
  }
  return out
}

export function parseSeries(text) {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
}

export function sampleSeries(kind) {
  if (kind === 'trend') {
    const out = []
    let v = 10
    for (let i = 0; i < 36; i++) {
      v += 1.5 + (Math.random() - 0.5) * 3
      out.push(Math.round(v * 10) / 10)
    }
    return out
  }
  if (kind === 'seasonal') {
    const out = []
    const base = 50
    for (let i = 0; i < 48; i++) {
      const s = 15 * Math.sin((i / 12) * 2 * Math.PI)
      out.push(Math.round((base + s + (Math.random() - 0.5) * 8) * 10) / 10)
    }
    return out
  }
  const out = []
  let v = 100
  for (let i = 0; i < 30; i++) {
    v += (Math.random() - 0.5) * 20
    out.push(Math.round(v * 10) / 10)
  }
  return out
}
