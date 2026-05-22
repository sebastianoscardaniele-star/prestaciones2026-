import React, { useEffect, useMemo, useState } from 'react';
import { dataFile, resumen } from './data.js';
import { ungzip } from 'pako';
import { Search, TrendingUp, Download, UploadCloud, Calculator, Filter, ArrowUpDown } from 'lucide-react';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
const norm = (v='') => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function csvEscape(v){ return `"${String(v ?? '').replaceAll('"','""')}"`; }
function downloadCsv(rows, name){
  const cols = ['proveedor','tipo','vigencia','codigo','descripcion','variante','precio','archivo','hoja'];
  const body = [cols.join(','), ...rows.map(r => cols.map(c => csvEscape(c === 'precio' ? Number(r[c]).toFixed(2) : r[c])).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + body], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function StatCard({title, value, hint}){ return <div className="card stat"><span>{title}</span><strong>{value}</strong><small>{hint}</small></div>; }

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

  const cheapest = filtered.length ? filtered.reduce((m,r)=> r.precio < m.precio ? r : m, filtered[0]) : null;
  const groups = useMemo(()=>{
    const map = new Map();
    for(const r of filtered){
      const key = r.codigo ? `COD ${r.codigo}` : norm(r.descripcion).slice(0,80);
      if(!map.has(key)) map.set(key, { key, label: r.codigo ? `${r.codigo} · ${r.descripcion}` : r.descripcion, items: []});
      map.get(key).items.push(r);
    }
    return Array.from(map.values()).filter(g=>g.items.length>1).slice(0,300);
  }, [filtered]);
  const selectedGroup = useMemo(()=> groups.find(g=>g.key===selectedKey) || groups[0], [groups, selectedKey]);
  const matrix = useMemo(()=> selectedGroup ? [...selectedGroup.items].sort((a,b)=>a.precio-b.precio) : [], [selectedGroup]);
  const avg = filtered.length ? filtered.reduce((s,r)=>s+r.precio,0)/filtered.length : 0;

  if (loading) return <main><section className="card loading"><h1>Comparador de prestaciones 2026</h1><p>Cargando base unificada...</p></section></main>;
  if (loadError) return <main><section className="card loading"><h1>Error al cargar datos</h1><p>{loadError}</p></section></main>;

  function applyIncrease(){
    const p = providerToUpdate || (proveedor !== 'Todos' ? proveedor : '');
    const n = Number(pct);
    if(!p || !Number.isFinite(n)) return alert('Elegí un prestador y un porcentaje válido.');
    setRows(rs => rs.map(r => r.proveedor===p ? {...r, precio: Math.round(r.precio * (1+n/100) * 100)/100, variante: `${r.variante} · ajustado ${n}%`} : r));
    alert(`Aumento aplicado a ${p}: ${n}%`);
  }

  return <main>
    <header className="hero">
      <div><p className="eyebrow">Comparador de prestaciones 2026</p><h1>Buscador, matriz y simulador de precios</h1><p>Base unificada desde {resumen.archivos.length} archivos tomados como únicos. Buscá una prestación, identificá quién la realiza, cuál es más barata y simulá aumentos por prestador.</p></div>
      <button className="primary" onClick={()=>downloadCsv(filtered, 'prestaciones-filtradas.csv')}><Download size={18}/> Exportar filtrado</button>
    </header>

    <section className="stats">
      <StatCard title="Registros cargados" value={rows.length.toLocaleString('es-AR')} hint="filas/precios normalizados" />
      <StatCard title="Prestadores" value={proveedores.length-1} hint="instituciones detectadas" />
      <StatCard title="Resultado actual" value={filtered.length.toLocaleString('es-AR')} hint="según filtros" />
      <StatCard title="Promedio filtrado" value={money.format(avg)} hint="precio medio" />
    </section>

    <section className="card controls">
      <label className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por código, descripción, prestador o variante..." /></label>
      <select value={proveedor} onChange={e=>setProveedor(e.target.value)}>{proveedores.map(x=><option key={x}>{x}</option>)}</select>
      <select value={tipo} onChange={e=>setTipo(e.target.value)}>{tipos.map(x=><option key={x}>{x}</option>)}</select>
      <select value={vigencia} onChange={e=>setVigencia(e.target.value)}>{vigencias.map(x=><option key={x}>{x}</option>)}</select>
      <select value={sort} onChange={e=>setSort(e.target.value)}><option value="precioAsc">Menor precio</option><option value="precioDesc">Mayor precio</option><option value="proveedor">Prestador A-Z</option></select>
    </section>

    <section className="grid2">
      <div className="card highlight"><h2><Calculator/> Más barata en el filtro</h2>{cheapest ? <><strong>{money.format(cheapest.precio)}</strong><p>{cheapest.proveedor} · {cheapest.descripcion}</p><small>{cheapest.codigo || 'Sin código'} · {cheapest.tipo} · {cheapest.vigencia}</small></> : <p>Sin resultados.</p>}</div>
      <div className="card adjust"><h2><TrendingUp/> Aumento masivo por prestador</h2><div className="inline"><select value={providerToUpdate} onChange={e=>setProviderToUpdate(e.target.value)}><option value="">Elegir prestador</option>{proveedores.filter(x=>x!=='Todos').map(x=><option key={x}>{x}</option>)}</select><input type="number" value={pct} onChange={e=>setPct(e.target.value)} placeholder="%"/><button onClick={applyIncrease}>Aplicar</button></div><small>El ajuste modifica la sesión actual. Luego podés exportar el CSV actualizado.</small></div>
    </section>

    <section className="card matrix"><h2><Filter/> Matriz comparativa</h2><p>Se agrupa por código cuando existe. Elegí una prestación para ver prestadores y precios ordenados.</p><select value={selectedGroup?.key || ''} onChange={e=>setSelectedKey(e.target.value)}>{groups.map(g=><option key={g.key} value={g.key}>{g.label.slice(0,140)}</option>)}</select><div className="matrixList">{matrix.slice(0,80).map((r,i)=><div className={i===0?'best':''} key={`${r.id}-${i}`}><span>{i===0?'Más barata':'Opción'}</span><b>{r.proveedor}</b><em>{r.variante}</em><strong>{money.format(r.precio)}</strong><small>{r.tipo} · {r.archivo}</small></div>)}</div></section>

    <section className="card"><h2><ArrowUpDown/> Resultados</h2><div className="tableWrap"><table><thead><tr><th>Prestador</th><th>Tipo</th><th>Vigencia</th><th>Código</th><th>Prestación</th><th>Variante</th><th>Precio</th><th>Archivo</th></tr></thead><tbody>{filtered.slice(0,1000).map(r=><tr key={r.id}><td>{r.proveedor}</td><td>{r.tipo}</td><td>{r.vigencia}</td><td>{r.codigo}</td><td>{r.descripcion}</td><td>{r.variante}</td><td className="price">{money.format(r.precio)}</td><td>{r.archivo}</td></tr>)}</tbody></table></div><small>Se muestran hasta 1.000 filas por rendimiento. Usá búsqueda/filtros o exportá el resultado completo.</small></section>

    <section className="card files"><h2><UploadCloud/> Archivos compilados</h2><div>{resumen.archivos.map(f=><span key={f.archivo}>{f.proveedor} · {f.tipo}: {f.registros.toLocaleString('es-AR')}</span>)}</div></section>
  </main>;
}
