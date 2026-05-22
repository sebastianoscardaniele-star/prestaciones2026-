import React, { useEffect, useMemo, useState } from 'react';
import { dataFile, resumen } from './data.js';
import { ungzip } from 'pako';
import { Search, TrendingUp, Download, UploadCloud, Calculator, Filter, ArrowUpDown, Medal, Building2, BarChart3 } from 'lucide-react';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
const norm = (v='') => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

function csvEscape(v){ return `"${String(v ?? '').replaceAll('"','""')}"`; }
function downloadCsv(rows, name){
  const cols = ['proveedor','tipo','vigencia','codigo','descripcion','variante','precio','archivo','hoja'];
  const body = [cols.join(','), ...rows.map(r => cols.map(c => csvEscape(c === 'precio' ? Number(r[c]).toFixed(2) : r[c])).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + body], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function StatCard({title, value, hint}){ return <div className="card stat"><span>{title}</span><strong>{value}</strong><small>{hint}</small></div>; }
function comparisonKey(r){
  const code = norm(r.codigo);
  if(code && code !== 'nan' && code !== 's/c' && code !== '-') return `COD::${code}`;
  return `DESC::${norm(r.descripcion).slice(0,120)}`;
}
function groupLabel(r){ return r.codigo ? `${r.codigo} · ${r.descripcion}` : r.descripcion; }

export default function App(){
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [proveedor, setProveedor] = useState('Todos');
  const [tipo, setTipo] = useState('Todos');
  const [vigencia, setVigencia] = useState('Todas');
  const [sort, setSort] = useState('precioAsc');
  const [pct, setPct] = useState(0);
  const [providerToUpdate, setProviderToUpdate] = useState('');
  const [selectedKey, setSelectedKey] = useState('');

  useEffect(() => {
    let alive = true;
    async function loadData(){
      try {
        setLoading(true);
        const response = await fetch(dataFile);
        if(!response.ok) throw new Error(`No se pudo cargar ${dataFile}`);
        const compressed = new Uint8Array(await response.arrayBuffer());
        const jsonText = ungzip(compressed, { to: 'string' });
        if(alive) setRows(JSON.parse(jsonText));
      } catch (error) {
        if(alive) setLoadError(error.message || 'Error al cargar datos');
      } finally {
        if(alive) setLoading(false);
      }
    }
    loadData();
    return () => { alive = false; };
  }, []);

  const proveedores = useMemo(()=>['Todos', ...Array.from(new Set(rows.map(r=>r.proveedor))).sort()], [rows]);
  const tipos = useMemo(()=>['Todos', ...Array.from(new Set(rows.map(r=>r.tipo))).sort()], [rows]);
  const vigencias = useMemo(()=>['Todas', ...Array.from(new Set(rows.map(r=>r.vigencia))).sort()], [rows]);

  const filtered = useMemo(()=>{
    const query = norm(q);
    let out = rows.filter(r =>
      (proveedor==='Todos' || r.proveedor===proveedor) &&
      (tipo==='Todos' || r.tipo===tipo) &&
      (vigencia==='Todas' || r.vigencia===vigencia) &&
      (!query || norm(`${r.codigo} ${r.descripcion} ${r.proveedor} ${r.tipo} ${r.variante}`).includes(query))
    );
    out = [...out].sort((a,b)=> sort==='precioDesc' ? b.precio-a.precio : sort==='proveedor' ? a.proveedor.localeCompare(b.proveedor) : a.precio-b.precio);
    return out;
  }, [rows, q, proveedor, tipo, vigencia, sort]);

  const comparisonGroups = useMemo(()=>{
    const map = new Map();
    for(const r of filtered){
      const key = comparisonKey(r);
      if(!map.has(key)) map.set(key, { key, label: groupLabel(r), items: [], providers: new Set() });
      const g = map.get(key);
      g.items.push(r);
      g.providers.add(r.proveedor);
    }
    return Array.from(map.values())
      .map(g => ({ ...g, providerCount: g.providers.size, minPrice: Math.min(...g.items.map(x=>x.precio)) }))
      .filter(g => g.providerCount >= 2)
      .sort((a,b)=> b.providerCount - a.providerCount || a.minPrice - b.minPrice || a.label.localeCompare(b.label))
      .slice(0,1000);
  }, [filtered]);

  const selectedGroup = useMemo(()=> comparisonGroups.find(g=>g.key===selectedKey) || comparisonGroups[0] || null, [comparisonGroups, selectedKey]);

  const providerBestRows = useMemo(()=>{
    if(!selectedGroup) return [];
    const byProvider = new Map();
    for(const r of selectedGroup.items){
      const current = byProvider.get(r.proveedor);
      if(!current || r.precio < current.precio) byProvider.set(r.proveedor, r);
    }
    return Array.from(byProvider.values()).sort((a,b)=>a.precio-b.precio || a.proveedor.localeCompare(b.proveedor));
  }, [selectedGroup]);

  const top3 = providerBestRows.slice(0,3);
  const cheapest = filtered.length ? filtered.reduce((m,r)=> r.precio < m.precio ? r : m, filtered[0]) : null;
  const avg = filtered.length ? filtered.reduce((s,r)=>s+r.precio,0)/filtered.length : 0;
  const comparisonAvg = providerBestRows.length ? providerBestRows.reduce((s,r)=>s+r.precio,0)/providerBestRows.length : 0;
  const gap = top3.length > 1 ? top3[1].precio - top3[0].precio : 0;

  if (loading) return <main><section className="card loading"><h1>Comparador de prestaciones 2026</h1><p>Cargando base unificada...</p></section></main>;
  if (loadError) return <main><section className="card loading"><h1>Error al cargar datos</h1><p>{loadError}</p></section></main>;

  function applyIncrease(){
    const p = providerToUpdate || (proveedor !== 'Todos' ? proveedor : '');
    const n = Number(pct);
    if(!p || !Number.isFinite(n)) return alert('Elegí un prestador y un porcentaje válido.');
    setRows(rs => rs.map(r => r.proveedor===p ? {...r, precio: Math.round(r.precio * (1+n/100) * 100)/100, variante: `${r.variante || ''} · ajustado ${n}%`} : r));
    alert(`Aumento aplicado a ${p}: ${n}%`);
  }

  return <main>
    <header className="hero">
      <div><p className="eyebrow">Comparador de prestaciones 2026</p><h1>Buscador, matriz y top 3 de precios por clínica</h1><p>Buscá una prestación y compará automáticamente qué clínicas la realizan, cuál es la más barata y el top 3 de mejores precios. También podés simular aumentos por prestador y exportar resultados.</p></div>
      <button className="primary" onClick={()=>downloadCsv(filtered, 'prestaciones-filtradas.csv')}><Download size={18}/> Exportar filtrado</button>
    </header>

    <section className="stats">
      <StatCard title="Registros cargados" value={rows.length.toLocaleString('es-AR')} hint="filas/precios normalizados" />
      <StatCard title="Prestadores" value={proveedores.length-1} hint="instituciones detectadas" />
      <StatCard title="Comparables" value={comparisonGroups.length.toLocaleString('es-AR')} hint="prestaciones en 2+ clínicas" />
      <StatCard title="Promedio filtrado" value={money.format(avg)} hint="precio medio" />
    </section>

    <section className="card controls">
      <label className="search"><Search size={18}/><input value={q} onChange={e=>{setQ(e.target.value); setSelectedKey('');}} placeholder="Buscar prestación: código, descripción, prestador o variante..." /></label>
      <select value={proveedor} onChange={e=>{setProveedor(e.target.value); setSelectedKey('');}}>{proveedores.map(x=><option key={x}>{x}</option>)}</select>
      <select value={tipo} onChange={e=>{setTipo(e.target.value); setSelectedKey('');}}>{tipos.map(x=><option key={x}>{x}</option>)}</select>
      <select value={vigencia} onChange={e=>{setVigencia(e.target.value); setSelectedKey('');}}>{vigencias.map(x=><option key={x}>{x}</option>)}</select>
      <select value={sort} onChange={e=>setSort(e.target.value)}><option value="precioAsc">Menor precio</option><option value="precioDesc">Mayor precio</option><option value="proveedor">Prestador A-Z</option></select>
    </section>

    <section className="card comparisonPanel">
      <div className="sectionTitle"><h2><BarChart3/> Comparar una prestación entre clínicas</h2><p>El comparador agrupa por código cuando existe y, si no hay código, por descripción normalizada. Para cada clínica se toma el precio más bajo encontrado para esa misma prestación.</p></div>
      <select className="wideSelect" value={selectedGroup?.key || ''} onChange={e=>setSelectedKey(e.target.value)}>
        {comparisonGroups.length ? comparisonGroups.map(g=><option key={g.key} value={g.key}>{g.label.slice(0,160)} · {g.providerCount} clínicas</option>) : <option>No hay prestaciones comparables con estos filtros</option>}
      </select>
      {selectedGroup && <div className="compareSummary">
        <div><span>Prestación seleccionada</span><strong>{selectedGroup.label}</strong></div>
        <div><span>Clínicas comparadas</span><strong>{providerBestRows.length}</strong></div>
        <div><span>Promedio</span><strong>{money.format(comparisonAvg)}</strong></div>
        <div><span>Diferencia 1° vs 2°</span><strong>{money.format(gap)}</strong></div>
      </div>}
    </section>

    <section className="grid2">
      <div className="card top3"><h2><Medal/> Top 3 más baratos</h2>{top3.length ? <div className="podium">{top3.map((r,i)=><div className={`rank rank${i+1}`} key={`${r.id}-${i}`}><span>#{i+1}</span><b>{r.proveedor}</b><strong>{money.format(r.precio)}</strong><small>{r.tipo} · {r.vigencia}</small><em>{r.variante || 'Sin variante'}</em></div>)}</div> : <p>Buscá o seleccioná una prestación comparable para ver el top 3.</p>}</div>
      <div className="card adjust"><h2><TrendingUp/> Aumento masivo por prestador</h2><div className="inline"><select value={providerToUpdate} onChange={e=>setProviderToUpdate(e.target.value)}><option value="">Elegir prestador</option>{proveedores.filter(x=>x!=='Todos').map(x=><option key={x}>{x}</option>)}</select><input type="number" value={pct} onChange={e=>setPct(e.target.value)} placeholder="%"/><button onClick={applyIncrease}>Aplicar</button></div><small>El ajuste modifica la sesión actual. Luego podés exportar el CSV actualizado.</small></div>
    </section>

    <section className="card matrix"><h2><Building2/> Matriz comparativa de clínicas</h2><p>Lista ordenada de menor a mayor precio para la prestación seleccionada.</p><div className="matrixList">{providerBestRows.slice(0,80).map((r,i)=><div className={i===0?'best':''} key={`${r.id}-${i}`}><span>{i===0?'Más barata':`Opción ${i+1}`}</span><b>{r.proveedor}</b><em>{r.variante || 'Sin variante'}</em><strong>{money.format(r.precio)}</strong><small>{r.tipo} · {r.archivo}</small></div>)}</div></section>

    <section className="grid2">
      <div className="card highlight"><h2><Calculator/> Más barata en el filtro general</h2>{cheapest ? <><strong>{money.format(cheapest.precio)}</strong><p>{cheapest.proveedor} · {cheapest.descripcion}</p><small>{cheapest.codigo || 'Sin código'} · {cheapest.tipo} · {cheapest.vigencia}</small></> : <p>Sin resultados.</p>}</div>
      <div className="card"><h2><Filter/> Ayuda rápida</h2><p>Para comparar entre clínicas, escribí el nombre o código de la prestación en el buscador, elegí la prestación en el selector y mirá el top 3. Si filtrás por un solo prestador no habrá comparación entre clínicas.</p></div>
    </section>

    <section className="card"><h2><ArrowUpDown/> Resultados</h2><div className="tableWrap"><table><thead><tr><th>Prestador</th><th>Tipo</th><th>Vigencia</th><th>Código</th><th>Prestación</th><th>Variante</th><th>Precio</th><th>Archivo</th></tr></thead><tbody>{filtered.slice(0,1000).map(r=><tr key={r.id}><td>{r.proveedor}</td><td>{r.tipo}</td><td>{r.vigencia}</td><td>{r.codigo}</td><td>{r.descripcion}</td><td>{r.variante}</td><td className="price">{money.format(r.precio)}</td><td>{r.archivo}</td></tr>)}</tbody></table></div><small>Se muestran hasta 1.000 filas por rendimiento. Usá búsqueda/filtros o exportá el resultado completo.</small></section>

    <section className="card files"><h2><UploadCloud/> Archivos compilados</h2><div>{resumen.archivos.map(f=><span key={f.archivo}>{f.proveedor} · {f.tipo}: {f.registros.toLocaleString('es-AR')}</span>)}</div></section>
  </main>;
}
