import { useState, useRef, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ─── STORES ──────────────────────────────────────────────────────────────────
const STORES = [
  "Mercado Livre","Amazon Brasil","Magazine Luiza",
  "Americanas","Shopee","Casas Bahia","Kabum","AliExpress"
];

const STORE_COLORS = {
  "Mercado Livre":  "#FFE600",
  "Amazon Brasil":  "#FF9900",
  "Magazine Luiza": "#0086FF",
  "Americanas":     "#CC0000",
  "Shopee":         "#EE4D2D",
  "Casas Bahia":    "#006BB8",
  "Kabum":          "#FF6A00",
  "AliExpress":     "#E43225",
};

// ─── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    label: "Dark", icon: "🌑",
    "--bg":          "#07090d",
    "--surface":     "#0d1117",
    "--surface2":    "rgba(255,255,255,0.04)",
    "--border":      "rgba(255,255,255,0.08)",
    "--accent":      "#00e676",
    "--accent-dim":  "rgba(0,230,118,0.12)",
    "--text":        "#e8edf2",
    "--text-muted":  "#556070",
    "--user-bg":     "linear-gradient(135deg,#1a2550,#2d3a7a)",
    "--user-border": "rgba(80,120,230,0.35)",
    "--card-best":   "linear-gradient(135deg,#092918,#0d3d20)",
    "--sidebar-bg":  "rgba(0,0,0,0.45)",
    "--header-bg":   "rgba(7,9,13,0.85)",
    "--input-bg":    "rgba(255,255,255,0.03)",
    "--toast-bg":    "#0d3d20",
  },
  light: {
    label: "Light", icon: "☀️",
    "--bg":          "#eef1f5",
    "--surface":     "#ffffff",
    "--surface2":    "rgba(0,0,0,0.03)",
    "--border":      "rgba(0,0,0,0.09)",
    "--accent":      "#16a34a",
    "--accent-dim":  "rgba(22,163,74,0.1)",
    "--text":        "#111827",
    "--text-muted":  "#9ca3af",
    "--user-bg":     "linear-gradient(135deg,#4f46e5,#7c3aed)",
    "--user-border": "rgba(79,70,229,0.3)",
    "--card-best":   "linear-gradient(135deg,#dcfce7,#bbf7d0)",
    "--sidebar-bg":  "rgba(255,255,255,0.75)",
    "--header-bg":   "rgba(238,241,245,0.9)",
    "--input-bg":    "#ffffff",
    "--toast-bg":    "#dcfce7",
  },
  warm: {
    label: "Noturno", icon: "🔥",
    "--bg":          "#130900",
    "--surface":     "#1a0e00",
    "--surface2":    "rgba(255,120,0,0.04)",
    "--border":      "rgba(200,100,0,0.12)",
    "--accent":      "#f59e0b",
    "--accent-dim":  "rgba(245,158,11,0.12)",
    "--text":        "#f0d9b5",
    "--text-muted":  "#7a5c30",
    "--user-bg":     "linear-gradient(135deg,#5c2a00,#7a3d00)",
    "--user-border": "rgba(180,80,0,0.35)",
    "--card-best":   "linear-gradient(135deg,#2d1400,#3d1e00)",
    "--sidebar-bg":  "rgba(0,0,0,0.5)",
    "--header-bg":   "rgba(19,9,0,0.9)",
    "--input-bg":    "rgba(255,120,0,0.04)",
    "--toast-bg":    "#3d2200",
  },
};

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
const SYSTEM = `Você é um assistente especialista em comparação de preços online no Brasil.

Lojas que você DEVE pesquisar: ${STORES.join(", ")}.

Regras:
1. Se o produto for vago (só categoria, sem modelo/marca), faça perguntas: marca, modelo, cor, tamanho, versão, especificações.
2. Só busque quando tiver detalhes suficientes para identificar o produto com precisão.
3. Ao buscar, procure em TODAS as ${STORES.length} lojas acima.
4. Responda SEMPRE em português.
5. Após buscar, retorne o JSON EXATAMENTE neste formato (sem texto extra antes ou depois do JSON):

\`\`\`json
{
  "produto": "Nome completo e específico do produto",
  "resultados": [
    {
      "loja": "Nome da loja (exatamente como na lista)",
      "preco": 1299.99,
      "preco_formatado": "R$\\u00a01.299,99",
      "link": "https://...",
      "disponivel": true,
      "frete_gratis": false,
      "parcelamento": "12x de R$\\u00a0108,33 sem juros"
    }
  ]
}
\`\`\`

Inclua apenas lojas onde encontrou o produto. Se não encontrar em alguma, omita.`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const parseJson = (text) => {
  try {
    const m = text.match(/```json\n([\s\S]*?)\n```/);
    if (m) return JSON.parse(m[1]);
  } catch {}
  return null;
};

const extractText = (content) => {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content.filter(b => b.type === "text").map(b => b.text).join("");
};

const fmtBRL = (v) =>
  v != null ? `R$\u00a0${Number(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}` : "";

const generateChartData = (resultados) => {
  const days = 14;
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const entry = { dia: `${d.getDate()}/${d.getMonth() + 1}` };
    resultados.forEach(r => {
      const variance = r.preco * 0.08;
      const trend = i === days - 1 ? 0 : (Math.random() - 0.45) * variance;
      entry[r.loja] = +(r.preco + trend).toFixed(2);
    });
    return entry;
  });
};

// ─── TOAST ───────────────────────────────────────────────────────────────────
const Toast = ({ msg, onClose }) => (
  <div style={{
    position:"fixed", bottom:24, right:24, zIndex:9999,
    background:"var(--toast-bg)", border:"1px solid var(--accent)",
    borderRadius:12, padding:"14px 20px", maxWidth:320,
    color:"var(--accent)", fontFamily:"'Space Mono',monospace",
    fontSize:13, boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
    animation:"slideUp 0.3s ease", display:"flex", gap:12, alignItems:"center"
  }}>
    <span>🔔</span>
    <span style={{flex:1}}>{msg}</span>
    <button onClick={onClose} style={{
      background:"transparent", border:"none", color:"var(--accent)",
      cursor:"pointer", fontSize:16, lineHeight:1
    }}>×</button>
  </div>
);

// ─── ALERT MODAL ─────────────────────────────────────────────────────────────
const AlertModal = ({ produto, preco, onSave, onClose }) => {
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState(preco ? (preco * 0.9).toFixed(2) : "");
  const [loja, setLoja] = useState("Qualquer loja");

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:999,
      background:"rgba(0,0,0,0.7)", display:"flex",
      alignItems:"center", justifyContent:"center",
      backdropFilter:"blur(4px)"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:16, padding:28, width:360, maxWidth:"90vw",
        boxShadow:"0 24px 64px rgba(0,0,0,0.5)"
      }}>
        <div style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, color:"var(--text)", marginBottom:4}}>
          🔔 Criar Alerta
        </div>
        <div style={{fontSize:13, color:"var(--text-muted)", marginBottom:20, fontFamily:"'Space Mono',monospace"}}>
          {produto}
        </div>

        {[
          {label:"Seu e-mail", val:email, set:setEmail, type:"email", ph:"voce@email.com"},
          {label:"Preço alvo (R$)", val:target, set:setTarget, type:"number", ph:"0,00"},
        ].map(f => (
          <div key={f.label} style={{marginBottom:14}}>
            <label style={{display:"block", fontSize:11, color:"var(--text-muted)", fontFamily:"'Space Mono',monospace", letterSpacing:1, marginBottom:6}}>
              {f.label.toUpperCase()}
            </label>
            <input
              type={f.type} value={f.val}
              onChange={e => f.set(e.target.value)}
              placeholder={f.ph}
              style={{
                width:"100%", background:"var(--input-bg)",
                border:"1px solid var(--border)", borderRadius:8,
                padding:"10px 14px", color:"var(--text)", fontSize:14,
                fontFamily:"'Space Mono',monospace", outline:"none",
                boxSizing:"border-box"
              }}
            />
          </div>
        ))}

        <div style={{marginBottom:20}}>
          <label style={{display:"block", fontSize:11, color:"var(--text-muted)", fontFamily:"'Space Mono',monospace", letterSpacing:1, marginBottom:6}}>
            LOJA
          </label>
          <select value={loja} onChange={e => setLoja(e.target.value)} style={{
            width:"100%", background:"var(--input-bg)",
            border:"1px solid var(--border)", borderRadius:8,
            padding:"10px 14px", color:"var(--text)", fontSize:14,
            fontFamily:"'Space Mono',monospace", outline:"none", cursor:"pointer"
          }}>
            <option>Qualquer loja</option>
            {STORES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div style={{display:"flex", gap:10}}>
          <button onClick={onClose} style={{
            flex:1, padding:"10px", borderRadius:8,
            border:"1px solid var(--border)", background:"transparent",
            color:"var(--text-muted)", cursor:"pointer", fontSize:14,
            fontFamily:"'Syne',sans-serif", fontWeight:600
          }}>Cancelar</button>
          <button onClick={() => onSave({produto, email, target: parseFloat(target), loja})} style={{
            flex:2, padding:"10px", borderRadius:8, border:"none",
            background:"var(--accent)", color:"#000", cursor:"pointer",
            fontSize:14, fontFamily:"'Syne',sans-serif", fontWeight:800
          }}>Salvar Alerta</button>
        </div>
      </div>
    </div>
  );
};

// ─── PRICE CARD ──────────────────────────────────────────────────────────────
const PriceCard = ({ item, isBest, onFavorite, isFav, canFav, onAlert }) => {
  const color = STORE_COLORS[item.loja] || "#888";
  return (
    <div style={{
      background: isBest ? "var(--card-best)" : "var(--surface2)",
      border: `1px solid ${isBest ? "var(--accent)" : "var(--border)"}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 12, padding: "14px 16px",
      transition: "transform 0.15s, box-shadow 0.15s",
      position: "relative",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      {isBest && (
        <div style={{
          position:"absolute", top:-10, right:12,
          background:"var(--accent)", color:"#000",
          fontSize:10, fontWeight:800, padding:"2px 10px",
          borderRadius:20, letterSpacing:1,
          fontFamily:"'Space Mono',monospace"
        }}>MENOR PREÇO</div>
      )}

      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8}}>
        <div style={{flex:1}}>
          <div style={{
            fontSize:11, fontWeight:700, color, letterSpacing:1,
            fontFamily:"'Space Mono',monospace", textTransform:"uppercase", marginBottom:4
          }}>{item.loja}</div>
          <div style={{
            fontSize:22, fontWeight:800, color: isBest ? "var(--accent)" : "var(--text)",
            fontFamily:"'Space Mono',monospace", lineHeight:1
          }}>{item.preco_formatado || fmtBRL(item.preco)}</div>
          {item.parcelamento && (
            <div style={{fontSize:11, color:"var(--text-muted)", marginTop:4}}>{item.parcelamento}</div>
          )}
          {item.frete_gratis && (
            <div style={{fontSize:11, color:"var(--accent)", marginTop:4, fontFamily:"'Space Mono',monospace"}}>
              ✓ Frete grátis
            </div>
          )}
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end"}}>
          {item.link && item.link !== "#" && (
            <a href={item.link} target="_blank" rel="noreferrer" style={{
              background:"var(--accent)", color:"#000",
              padding:"6px 12px", borderRadius:8, fontSize:12,
              fontWeight:800, textDecoration:"none",
              fontFamily:"'Space Mono',monospace", whiteSpace:"nowrap"
            }}>VER →</a>
          )}
          <button onClick={() => onFavorite(item)} title={isFav ? "Remover favorito" : "Favoritar"} style={{
            background:"transparent", border:"1px solid var(--border)",
            borderRadius:8, width:32, height:32, cursor: (!canFav && !isFav) ? "not-allowed" : "pointer",
            fontSize:16, opacity: (!canFav && !isFav) ? 0.35 : 1
          }}>{isFav ? "★" : "☆"}</button>
          <button onClick={() => onAlert(item)} title="Criar alerta de preço" style={{
            background:"transparent", border:"1px solid var(--border)",
            borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:14
          }}>🔔</button>
        </div>
      </div>
    </div>
  );
};

// ─── PRICE CHART ─────────────────────────────────────────────────────────────
const PriceChart = ({ resultados }) => {
  const data = generateChartData(resultados.slice(0, 5));
  const topStores = resultados.slice(0, 5).map(r => r.loja);

  return (
    <div style={{
      background:"var(--surface2)", border:"1px solid var(--border)",
      borderRadius:12, padding:"16px 8px 8px", marginTop:12
    }}>
      <div style={{
        fontSize:11, color:"var(--accent)", fontFamily:"'Space Mono',monospace",
        letterSpacing:2, textTransform:"uppercase", paddingLeft:12, marginBottom:12
      }}>◈ Variação de Preço — Estimativa 14 Dias</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{top:4, right:16, left:0, bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
          <XAxis dataKey="dia" tick={{fontSize:10, fill:"var(--text-muted)", fontFamily:"monospace"}} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} tick={{fontSize:10, fill:"var(--text-muted)", fontFamily:"monospace"}} axisLine={false} tickLine={false} width={56} />
          <Tooltip
            contentStyle={{background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12, fontFamily:"'Space Mono',monospace"}}
            formatter={(v) => [fmtBRL(v)]}
          />
          <Legend wrapperStyle={{fontSize:11, fontFamily:"'Space Mono',monospace"}} />
          {topStores.map(s => (
            <Line key={s} type="monotone" dataKey={s}
              stroke={STORE_COLORS[s] || "#888"}
              strokeWidth={2} dot={false} activeDot={{r:4}}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
const Sidebar = ({ history, favorites, alerts, onDelFav, onDelAlert, onSelectHistory, activeTab, setActiveTab }) => {
  const tabs = [
    { id:"history", label:"Histórico", icon:"🕐" },
    { id:"favorites", label:"Favoritos", icon:"★" },
    { id:"alerts", label:"Alertas", icon:"🔔" },
  ];

  return (
    <div style={{
      width: 240, flexShrink:0,
      background:"var(--sidebar-bg)",
      borderRight:"1px solid var(--border)",
      display:"flex", flexDirection:"column",
      backdropFilter:"blur(12px)",
    }}>
      <div style={{display:"flex", borderBottom:"1px solid var(--border)"}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex:1, padding:"12px 4px", border:"none", cursor:"pointer",
            background: activeTab === t.id ? "var(--accent-dim)" : "transparent",
            borderBottom: activeTab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === t.id ? "var(--accent)" : "var(--text-muted)",
            fontSize:11, fontFamily:"'Space Mono',monospace",
            transition:"all 0.2s"
          }}>
            <div>{t.icon}</div>
            <div style={{fontSize:9, marginTop:2, letterSpacing:0.5}}>{t.label.toUpperCase()}</div>
          </button>
        ))}
      </div>

      <div style={{flex:1, overflowY:"auto", padding:12}}>
        {activeTab === "history" && (
          history.length === 0
            ? <div style={{color:"var(--text-muted)", fontSize:12, textAlign:"center", padding:"24px 8px", fontFamily:"'Space Mono',monospace"}}>Nenhuma busca ainda</div>
            : history.map((h, i) => (
              <div key={i} onClick={() => onSelectHistory(h.query)} style={{
                padding:"10px 12px", borderRadius:8, cursor:"pointer",
                background:"var(--surface2)", border:"1px solid var(--border)",
                marginBottom:8, transition:"background 0.15s"
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--accent-dim)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--surface2)"}
              >
                <div style={{fontSize:12, color:"var(--text)", fontWeight:700, lineHeight:1.3}}>{h.produto}</div>
                <div style={{display:"flex", justifyContent:"space-between", marginTop:4}}>
                  <span style={{fontSize:10, color:"var(--accent)", fontFamily:"'Space Mono',monospace"}}>{h.menor_preco}</span>
                  <span style={{fontSize:10, color:"var(--text-muted)", fontFamily:"'Space Mono',monospace"}}>{h.data}</span>
                </div>
              </div>
            ))
        )}

        {activeTab === "favorites" && (
          <>
            <div style={{fontSize:10, color:"var(--text-muted)", fontFamily:"'Space Mono',monospace", letterSpacing:1, marginBottom:10}}>
              {favorites.length}/5 FAVORITOS
            </div>
            {favorites.length === 0
              ? <div style={{color:"var(--text-muted)", fontSize:12, textAlign:"center", padding:"24px 8px", fontFamily:"'Space Mono',monospace"}}>Nenhum favorito salvo</div>
              : favorites.map((f, i) => (
                <div key={i} style={{
                  padding:"10px 12px", borderRadius:8,
                  background:"var(--surface2)", border:"1px solid var(--border)",
                  marginBottom:8,
                  borderLeft:`3px solid ${STORE_COLORS[f.loja] || "var(--accent)"}`
                }}>
                  <div style={{fontSize:11, color:"var(--text)", fontWeight:700, lineHeight:1.3, marginBottom:2}}>{f.produto}</div>
                  <div style={{fontSize:10, color:"var(--text-muted)", fontFamily:"'Space Mono',monospace"}}>{f.loja}</div>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6}}>
                    <span style={{fontSize:13, color:"var(--accent)", fontFamily:"'Space Mono',monospace", fontWeight:700}}>{f.preco_formatado || fmtBRL(f.preco)}</span>
                    <button onClick={() => onDelFav(i)} style={{
                      background:"transparent", border:"none", color:"var(--text-muted)",
                      cursor:"pointer", fontSize:14, padding:"0 4px"
                    }}>×</button>
                  </div>
                </div>
              ))
            }
          </>
        )}

        {activeTab === "alerts" && (
          alerts.length === 0
            ? <div style={{color:"var(--text-muted)", fontSize:12, textAlign:"center", padding:"24px 8px", fontFamily:"'Space Mono',monospace"}}>Nenhum alerta criado</div>
            : alerts.map((a, i) => (
              <div key={i} style={{
                padding:"10px 12px", borderRadius:8,
                background:"var(--surface2)", border:"1px solid var(--border)",
                marginBottom:8
              }}>
                <div style={{fontSize:11, color:"var(--text)", fontWeight:700, lineHeight:1.3}}>{a.produto}</div>
                <div style={{fontSize:10, color:"var(--text-muted)", fontFamily:"'Space Mono',monospace", marginTop:2}}>{a.loja}</div>
                <div style={{fontSize:10, color:"var(--accent)", fontFamily:"'Space Mono',monospace", marginTop:4}}>
                  Alerta abaixo de {fmtBRL(a.target)}
                </div>
                <div style={{fontSize:10, color:"var(--text-muted)", marginTop:2, wordBreak:"break-all"}}>{a.email}</div>
                <button onClick={() => onDelAlert(i)} style={{
                  marginTop:6, background:"transparent", border:"1px solid var(--border)",
                  borderRadius:6, padding:"3px 10px", fontSize:11, color:"var(--text-muted)",
                  cursor:"pointer", fontFamily:"'Space Mono',monospace"
                }}>Remover</button>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

// ─── CHAT MESSAGE ─────────────────────────────────────────────────────────────
const ChatMessage = ({ msg, onFavorite, favorites, alerts, onAlert, lastResults }) => {
  const priceData = msg.role === "assistant" ? parseJson(msg.content) : null;
  const cleanText = msg.content.replace(/```json[\s\S]*?```/g, "").trim();
  const isUser = msg.role === "user";

  return (
    <div style={{
      display:"flex", flexDirection: isUser ? "row-reverse" : "row",
      gap:10, alignItems:"flex-start",
      animation:"fadeSlide 0.3s ease"
    }}>
      <div style={{
        width:30, height:30, borderRadius:"50%", flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:13, fontWeight:800, color:"#fff",
        background: isUser
          ? "linear-gradient(135deg,#4f46e5,#7c3aed)"
          : "linear-gradient(135deg,var(--accent),#00b050)",
      }}>
        {isUser ? "U" : "◈"}
      </div>

      <div style={{maxWidth:"78%", display:"flex", flexDirection:"column", gap:10}}>
        {cleanText && (
          <div style={{
            background: isUser ? "var(--user-bg)" : "var(--surface2)",
            border: `1px solid ${isUser ? "var(--user-border)" : "var(--border)"}`,
            borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
            padding:"12px 16px", fontSize:14, lineHeight:1.65,
            color:"var(--text)", whiteSpace:"pre-wrap"
          }}>
            {cleanText}
          </div>
        )}

        {priceData?.resultados?.length > 0 && (
          <ResultsPanel
            data={priceData}
            onFavorite={onFavorite}
            favorites={favorites}
            onAlert={onAlert}
          />
        )}
      </div>
    </div>
  );
};

// ─── RESULTS PANEL ────────────────────────────────────────────────────────────
const ResultsPanel = ({ data, onFavorite, favorites, onAlert }) => {
  const [filterStores, setFilterStores] = useState(new Set(STORES));
  const [freteGratis, setFreteGratis] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const filtered = (data.resultados || []).filter(r =>
    filterStores.has(r.loja) && (!freteGratis || r.frete_gratis)
  ).sort((a,b) => a.preco - b.preco);

  const minPrice = filtered[0]?.preco;
  const savings = filtered.length > 1
    ? fmtBRL(filtered[filtered.length - 1].preco - filtered[0].preco)
    : null;

  const toggleStore = (s) => {
    setFilterStores(prev => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  };

  return (
    <div style={{
      background:"rgba(0,0,0,0.2)", border:"1px solid var(--accent)",
      borderRadius:16, padding:16, opacity:0.97
    }}>
      {/* Header */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11, color:"var(--accent)", fontFamily:"'Space Mono',monospace", letterSpacing:2, marginBottom:4}}>
          ◈ COMPARATIVO DE PREÇOS
        </div>
        <div style={{fontSize:15, fontWeight:800, color:"var(--text)"}}>{data.produto}</div>
        {savings && (
          <div style={{fontSize:12, color:"#f59e0b", fontFamily:"'Space Mono',monospace", marginTop:2}}>
            Economia de até {savings} na melhor escolha
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{marginBottom:12}}>
        <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:8}}>
          {STORES.map(s => (
            <button key={s} onClick={() => toggleStore(s)} style={{
              padding:"3px 10px", borderRadius:20, border:"1px solid",
              borderColor: filterStores.has(s) ? (STORE_COLORS[s] || "var(--accent)") : "var(--border)",
              background: filterStores.has(s) ? `${STORE_COLORS[s]}22` : "transparent",
              color: filterStores.has(s) ? (STORE_COLORS[s] || "var(--accent)") : "var(--text-muted)",
              fontSize:11, cursor:"pointer", fontFamily:"'Space Mono',monospace",
              transition:"all 0.15s"
            }}>{s}</button>
          ))}
        </div>
        <label style={{display:"flex", alignItems:"center", gap:8, cursor:"pointer", width:"fit-content"}}>
          <input type="checkbox" checked={freteGratis} onChange={e => setFreteGratis(e.target.checked)}
            style={{accentColor:"var(--accent)", width:14, height:14}} />
          <span style={{fontSize:12, color:"var(--text-muted)", fontFamily:"'Space Mono',monospace"}}>
            Apenas frete grátis
          </span>
        </label>
      </div>

      {/* Cards */}
      <div style={{display:"flex", flexDirection:"column", gap:8}}>
        {filtered.length === 0
          ? <div style={{color:"var(--text-muted)", fontSize:13, textAlign:"center", padding:20, fontFamily:"'Space Mono',monospace"}}>
              Nenhum resultado com os filtros selecionados
            </div>
          : filtered.map((item, i) => (
            <PriceCard
              key={i} item={{...item, produto: data.produto}}
              isBest={item.preco === minPrice}
              onFavorite={onFavorite}
              isFav={favorites.some(f => f.loja === item.loja && f.produto === data.produto)}
              canFav={favorites.length < 5}
              onAlert={() => onAlert(item, data.produto)}
            />
          ))
        }
      </div>

      {/* Chart toggle */}
      {filtered.length > 0 && (
        <>
          <button onClick={() => setShowChart(v => !v)} style={{
            marginTop:12, width:"100%", padding:"8px",
            background:"var(--surface2)", border:"1px solid var(--border)",
            borderRadius:8, color:"var(--text-muted)", fontSize:12,
            cursor:"pointer", fontFamily:"'Space Mono',monospace",
            transition:"all 0.2s"
          }}>
            {showChart ? "▲ Ocultar Gráfico" : "▼ Ver Variação de Preço (14 dias)"}
          </button>
          {showChart && <PriceChart resultados={filtered} />}
        </>
      )}
    </div>
  );
};

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState("dark");
  const [messages, setMessages] = useState([]);
  const [apiMessages, setApiMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState("history");
  const [alertModal, setAlertModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const t = THEMES[theme];

  // Apply CSS vars
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(t).forEach(([k, v]) => {
      if (k.startsWith("--")) root.style.setProperty(k, v);
    });
  }, [theme, t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const checkAlerts = useCallback((resultados, produto) => {
    alerts.forEach(a => {
      const match = resultados.find(r =>
        (a.loja === "Qualquer loja" || r.loja === a.loja) && r.preco <= a.target
      );
      if (match) {
        showToast(`🎉 Alerta! ${produto} na ${match.loja} por ${fmtBRL(match.preco)} — abaixo do seu limite!`);
      }
    });
  }, [alerts, showToast]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg = { role:"user", content: msg };
    const newApi = [...apiMessages, userMsg];

    setMessages(prev => [...prev, { role:"user", content: msg }]);
    setApiMessages(newApi);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:4000,
          system: SYSTEM,
          tools:[{ type:"web_search_20250305", name:"web_search" }],
          messages: newApi,
        })
      });
      const data = await res.json();
      const reply = extractText(data.content);

      setMessages(prev => [...prev, { role:"assistant", content: reply }]);
      setApiMessages(prev => [...prev, { role:"assistant", content: reply }]);

      // Save history & check alerts
      const parsed = parseJson(reply);
      if (parsed?.resultados?.length) {
        const sorted = [...parsed.resultados].sort((a,b) => a.preco - b.preco);
        setHistory(prev => [{
          produto: parsed.produto,
          query: msg,
          menor_preco: fmtBRL(sorted[0].preco),
          data: new Date().toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
        }, ...prev.slice(0, 19)]);
        checkAlerts(parsed.resultados, parsed.produto);
      }
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:"Erro ao buscar. Verifique sua conexão e tente novamente." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleFavorite = (item) => {
    setFavorites(prev => {
      const exists = prev.findIndex(f => f.loja === item.loja && f.produto === item.produto);
      if (exists >= 0) return prev.filter((_, i) => i !== exists);
      if (prev.length >= 5) { showToast("Limite de 5 favoritos atingido!"); return prev; }
      showToast(`★ ${item.produto} adicionado aos favoritos!`);
      setActiveTab("favorites");
      return [...prev, item];
    });
  };

  const handleAlertSave = (a) => {
    setAlerts(prev => [...prev, a]);
    setAlertModal(null);
    setActiveTab("alerts");
    showToast(`🔔 Alerta criado para ${a.produto}!`);
  };

  const EXAMPLES = ["iPhone 16 Pro Max 256GB Titânio Natural","Notebook Dell Inspiron 15 i7 16GB SSD 512","PS5 Slim com leitor de disco","Tênis Nike Air Max 270 Preto 42"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:var(--bg);}
        @keyframes fadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:var(--accent);border-radius:2px}
        textarea:focus,input:focus,select:focus{outline:none;}
        button{transition:opacity 0.15s;}
        button:hover{opacity:0.85;}
      `}</style>

      <div style={{
        height:"100vh", display:"flex", flexDirection:"column",
        background:"var(--bg)", fontFamily:"'Syne',sans-serif",
        color:"var(--text)", overflow:"hidden"
      }}>
        {/* HEADER */}
        <div style={{
          display:"flex", alignItems:"center", gap:12, padding:"12px 20px",
          borderBottom:"1px solid var(--border)",
          background:"var(--header-bg)", backdropFilter:"blur(16px)",
          flexShrink:0, zIndex:10
        }}>
          <button onClick={() => setSidebarOpen(v => !v)} style={{
            background:"var(--surface2)", border:"1px solid var(--border)",
            borderRadius:8, width:34, height:34, cursor:"pointer",
            color:"var(--text-muted)", fontSize:16
          }}>☰</button>

          <div style={{
            width:36, height:36, borderRadius:10,
            background:"linear-gradient(135deg,var(--accent),#00805a)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:18
          }}>🛒</div>

          <div>
            <div style={{fontSize:16, fontWeight:800, letterSpacing:"-0.5px", color:"var(--text)"}}>
              Monitor de Preços
            </div>
            <div style={{fontSize:10, color:"var(--accent)", fontFamily:"'Space Mono',monospace", letterSpacing:1}}>
              {STORES.length} LOJAS · CHAT IA · TEMPO REAL
            </div>
          </div>

          <div style={{marginLeft:"auto", display:"flex", gap:6}}>
            {Object.entries(THEMES).map(([k, v]) => (
              <button key={k} onClick={() => setTheme(k)} style={{
                padding:"5px 12px", borderRadius:20, border:"1px solid",
                borderColor: theme === k ? "var(--accent)" : "var(--border)",
                background: theme === k ? "var(--accent-dim)" : "transparent",
                color: theme === k ? "var(--accent)" : "var(--text-muted)",
                fontSize:12, cursor:"pointer", fontFamily:"'Space Mono',monospace"
              }}>{v.icon} {v.label}</button>
            ))}
          </div>
        </div>

        {/* BODY */}
        <div style={{flex:1, display:"flex", overflow:"hidden"}}>
          {/* SIDEBAR */}
          {sidebarOpen && (
            <Sidebar
              history={history}
              favorites={favorites}
              alerts={alerts}
              onDelFav={i => setFavorites(prev => prev.filter((_,j) => j !== i))}
              onDelAlert={i => setAlerts(prev => prev.filter((_,j) => j !== i))}
              onSelectHistory={q => send(q)}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          )}

          {/* MAIN */}
          <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
            {/* CHAT */}
            <div style={{
              flex:1, overflowY:"auto", padding:"24px 20px",
              display:"flex", flexDirection:"column", gap:20
            }}>
              {messages.length === 0 && (
                <div style={{
                  margin:"auto", textAlign:"center",
                  maxWidth:460, padding:"40px 20px",
                  animation:"fadeSlide 0.5s ease"
                }}>
                  <div style={{fontSize:48, marginBottom:16}}>🔍</div>
                  <div style={{fontSize:22, fontWeight:800, color:"var(--text)", marginBottom:8}}>
                    Compare preços em {STORES.length} lojas
                  </div>
                  <div style={{fontSize:14, color:"var(--text-muted)", lineHeight:1.7, marginBottom:28}}>
                    Diga qual produto quer encontrar. Se for vago, o assistente vai pedir mais detalhes antes de buscar.
                  </div>
                  <div style={{display:"flex", flexDirection:"column", gap:8}}>
                    {EXAMPLES.map(ex => (
                      <button key={ex} onClick={() => setInput(ex)} style={{
                        background:"var(--accent-dim)", border:"1px solid var(--border)",
                        borderRadius:10, padding:"11px 16px", color:"var(--accent)",
                        fontSize:13, cursor:"pointer", fontFamily:"'Space Mono',monospace",
                        textAlign:"left"
                      }}>→ {ex}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <ChatMessage
                  key={i} msg={msg}
                  onFavorite={handleFavorite}
                  favorites={favorites}
                  onAlert={(item, produto) => setAlertModal({...item, produto: produto || item.produto})}
                />
              ))}

              {loading && (
                <div style={{display:"flex", gap:10, alignItems:"center"}}>
                  <div style={{
                    width:30, height:30, borderRadius:"50%",
                    background:"linear-gradient(135deg,var(--accent),#00b050)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, color:"#fff", fontWeight:800, flexShrink:0
                  }}>◈</div>
                  <div style={{
                    background:"var(--surface2)", border:"1px solid var(--border)",
                    borderRadius:"4px 18px 18px 18px", padding:"12px 18px",
                    display:"flex", gap:6, alignItems:"center"
                  }}>
                    {[0,0.2,0.4].map((d,i) => (
                      <div key={i} style={{
                        width:6, height:6, borderRadius:"50%",
                        background:"var(--accent)",
                        animation:`pulse 1.2s ${d}s infinite`
                      }} />
                    ))}
                    <span style={{marginLeft:8, fontSize:11, color:"var(--text-muted)", fontFamily:"'Space Mono',monospace"}}>
                      pesquisando em {STORES.length} lojas...
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* INPUT */}
            <div style={{
              padding:"14px 20px 18px",
              borderTop:"1px solid var(--border)",
              background:"var(--header-bg)",
              backdropFilter:"blur(16px)", flexShrink:0
            }}>
              <div style={{
                display:"flex", gap:10, alignItems:"flex-end",
                background:"var(--input-bg)",
                border:"1px solid var(--border)",
                borderRadius:14, padding:"10px 10px 10px 16px",
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
                  placeholder="Ex: qual o preço do Samsung Galaxy S25 Ultra 512GB?"
                  rows={1}
                  style={{
                    flex:1, background:"transparent", border:"none",
                    color:"var(--text)", fontSize:14, resize:"none",
                    lineHeight:1.5, fontFamily:"'Syne',sans-serif",
                    maxHeight:100, overflowY:"auto"
                  }}
                  onInput={e => { e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  style={{
                    width:38, height:38, borderRadius:10, border:"none",
                    background: loading || !input.trim() ? "var(--accent-dim)" : "var(--accent)",
                    color: loading || !input.trim() ? "var(--text-muted)" : "#000",
                    fontSize:18, cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                    flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:800
                  }}
                >↑</button>
              </div>
              <div style={{
                textAlign:"center", fontSize:11, color:"var(--text-muted)",
                marginTop:8, fontFamily:"'Space Mono',monospace"
              }}>
                Enter para enviar · Shift+Enter para nova linha · favoritos: {favorites.length}/5
              </div>
            </div>
          </div>
        </div>
      </div>

      {alertModal && (
        <AlertModal
          produto={alertModal.produto}
          preco={alertModal.preco}
          onSave={handleAlertSave}
          onClose={() => setAlertModal(null)}
        />
      )}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </>
  );
}
