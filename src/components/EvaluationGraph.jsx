import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { displayEnginePoints } from '../engine/evaluation.js'

function formatGraphValue(value) {
  return `${value > 0 ? '+' : ''}${Math.round(value).toLocaleString('cs-CZ')}`
}

const MATE_BASELINE = 30000;

function formatTooltipValue(value) {
  if (Math.abs(value) > 10000) {
    const isWhite = value > 0;
    let mateDistance = MATE_BASELINE - Math.abs(value);
    if (mateDistance < 0) mateDistance = '?'; 
    return `${isWhite ? 'M' : '-M'}${mateDistance}`;
  }
  return formatGraphValue(value);
}

// Transformace pro graf: rozšiřuje malé hodnoty a stlačuje velké
function calculateLogHeight(rawPoints) {
  if (Math.abs(rawPoints) > 10000) {
    const isWhite = rawPoints > 0;
    let mateDistance = MATE_BASELINE - Math.abs(rawPoints);
    if (mateDistance < 1) mateDistance = 1;
    
    // Maty jsou drženy v nejvyšším pásmu (380 - 400), aby se nikdy nepřekrývaly 
    // s normálními logaritmickými hodnotami (např. +3000 eval = cca 347)
    let mateHeight = 400 - ((mateDistance - 1) * 2);
    mateHeight = Math.max(380, mateHeight);
    
    return isWhite ? mateHeight : -mateHeight;
  }
  
  // Pseudo-logaritmické měřítko 
  // 0 -> 0 | 100 -> 200 | 1000 -> 300
  return Math.sign(rawPoints) * (Math.log10(Math.abs(rawPoints) + 1) * 100);
}

// Zpětná (inverzní) transformace pro popisky osy Y, aby ukazovaly reálné body
function formatYAxisTick(mappedValue) {
  if (Math.abs(mappedValue) >= 380) {
    return mappedValue > 0 ? '+M' : '-M';
  }
  const realValue = Math.sign(mappedValue) * (Math.pow(10, Math.abs(mappedValue) / 100) - 1);
  return formatGraphValue(realValue);
}

function EvaluationGraph({ analyses, viewMode, currentMove }) {
  const visibleAnalyses = viewMode === 'full' ? analyses : analyses.slice(0, currentMove + 1)
  
  const graphData = visibleAnalyses
    .filter((analysis) => Number.isFinite(analysis?.score))
    .map((analysis, index) => {
      const rawPoints = displayEnginePoints(analysis.score);
      
      return {
        move: index,
        enginePoints: calculateLogHeight(rawPoints), // Transponovaná výška pro graf
        rawPoints: rawPoints // Uchováno pro Tooltip
      }
    })
    
  const currentMax = Math.max(...graphData.map(({ enginePoints }) => Math.abs(enginePoints)), 0)
  // Použití defaultní mapované hodnoty 100, aby prázdný graf nevypsal 0 třikrát na osu Y
  const graphMax = currentMax === 0 ? 100 : currentMax

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
              <YAxis 
                domain={[-graphMax, graphMax]} 
                ticks={[-graphMax, 0, graphMax]} 
                tickFormatter={formatYAxisTick} 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#7b8179', fontSize: 11 }} 
              />
              <ReferenceLine y={0} stroke="#b9bdb4" strokeWidth={1.25} />
              <Tooltip
                formatter={(value, name, props) => [formatTooltipValue(props.payload.rawPoints), 'Eval hodnota']}
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
    </section>
  )
}

export default EvaluationGraph