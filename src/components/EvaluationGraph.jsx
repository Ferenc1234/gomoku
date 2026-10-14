import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { displayEnginePoints } from '../engine/evaluation.js'

function formatGraphValue(value) {
  return `${value > 0 ? '+' : ''}${Math.round(value).toLocaleString('cs-CZ')}`
}

function EvaluationGraph({ analyses, viewMode, currentMove }) {
  const visibleAnalyses = viewMode === 'full' ? analyses : analyses.slice(0, currentMove + 1)
  const graphData = visibleAnalyses.filter((analysis) => Number.isFinite(analysis?.score)).map((analysis, index) => ({
    move: index,
    enginePoints: displayEnginePoints(analysis.score),
  }))
  const currentMax = Math.max(...graphData.map(({ enginePoints }) => Math.abs(enginePoints)), 0)
  const graphMax = currentMax === 0 ? 1 : currentMax

  return (
    <section className="panel graph-panel" aria-label="Graf hodnocení">
      <div className="panel-heading">
        <div><span className="eyebrow">PRŮBĚH PARTIE</span><h2>Hodnocení pozice</h2></div>
        <div className="graph-key"><span className="key-white" /> Bílý <span className="key-black" /> Černý</div>
      </div>
      <div className="graph-wrap">
        {graphData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={graphData} margin={{ top: 12, right: 12, left: -20, bottom: 2 }}>
              <defs>
                <linearGradient id="advantageFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a8cf37" stopOpacity={0.42} />
                  <stop offset="50%" stopColor="#a8cf37" stopOpacity={0.04} />
                  <stop offset="100%" stopColor="#f07c62" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e5e7df" strokeDasharray="3 5" />
              <XAxis dataKey="move" tickLine={false} axisLine={false} tick={{ fill: '#7b8179', fontSize: 11 }} />
              <YAxis domain={[-graphMax, graphMax]} ticks={[-graphMax, 0, graphMax]} tickFormatter={formatGraphValue} tickLine={false} axisLine={false} tick={{ fill: '#7b8179', fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#b9bdb4" strokeWidth={1.25} />
              <Tooltip
                formatter={(value) => [formatGraphValue(value), 'Eval hodnota']}
                labelFormatter={(label) => label === 0 ? 'Výchozí pozice' : `Po tahu ${label}`}
                contentStyle={{ border: '1px solid #e1e4da', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="enginePoints" stroke="#8cb52a" strokeWidth={2.5} fill="url(#advantageFill)" activeDot={{ r: 5, fill: '#8cb52a', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="graph-empty">Zatím není k dispozici dost tahů pro graf.</div>
        )}
      </div>
      <div className="graph-caption"><span>+ bílý</span><span>- černý</span></div>
    </section>
  )
}

export default EvaluationGraph