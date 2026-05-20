import React from 'react';

const LB_CATS = [
  {key:'materials',icon:'🔩',label:'Materials',color:'#1565c0'},
  {key:'insurance',icon:'🛡️',label:'Insurance',color:'#6a1b9a'},
  {key:'supplies',icon:'🧰',label:'Shop Supplies',color:'#e65100'},
  {key:'utilities',icon:'💡',label:'Utilities',color:'#f57f17'},
  {key:'rent',icon:'🏭',label:'Rent/Lease',color:'#2e7d32'},
  {key:'equipment',icon:'⚙️',label:'Equipment',color:'#37474f'},
  {key:'payroll',icon:'👥',label:'Payroll',color:'#880e4f'},
  {key:'other',icon:'📎',label:'Other',color:'#616161'},
];

export default function HealthTab({ health, healthLoad, fmt }) {
  return (
    <div>
      {healthLoad ? (
        <div style={{textAlign:'center',padding:40}}>Loading...</div>
      ) : health ? (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
            <div style={{padding:20,borderRadius:12,background:'#E8F5E9',border:'2px solid #66BB6A',textAlign:'center'}}><div style={{fontSize:'0.85rem',color:'#555'}}>Total Revenue</div><div style={{fontSize:'2rem',fontWeight:800,color:'#2e7d32'}}>{fmt(health.totalRevenue)}</div><div style={{fontSize:'0.8rem',color:'#888'}}>{health.woCount} work orders</div></div>
            <div style={{padding:20,borderRadius:12,background:'#FFEBEE',border:'2px solid #EF5350',textAlign:'center'}}><div style={{fontSize:'0.85rem',color:'#555'}}>Total Expenses</div><div style={{fontSize:'2rem',fontWeight:800,color:'#c62828'}}>{fmt(health.totalExpenses)}</div><div style={{fontSize:'0.8rem',color:'#888'}}>{health.billCount} paid bills</div></div>
            <div style={{padding:20,borderRadius:12,background:health.profit>=0?'#E8F5E9':'#FFEBEE',border:`2px solid ${health.profit>=0?'#66BB6A':'#EF5350'}`,textAlign:'center'}}><div style={{fontSize:'0.85rem',color:'#555'}}>Profit</div><div style={{fontSize:'2rem',fontWeight:800,color:health.profit>=0?'#2e7d32':'#c62828'}}>{fmt(health.profit)}</div><div style={{fontSize:'0.8rem',color:'#888'}}>{health.totalRevenue>0?Math.round((health.profit/health.totalRevenue)*100):0}% margin</div></div>
          </div>
          <div className="card"><h3 style={{marginBottom:16}}>💸 Where Money Goes</h3>
            {Object.keys(health.expensesByCategory).length===0
              ? <div style={{textAlign:'center',padding:20,color:'#888'}}>No paid bills yet. Track bills in Liabilities tab.</div>
              : <div>{(()=>{const s=Object.entries(health.expensesByCategory).sort((a,b)=>b[1]-a[1]);const mx=s[0]?.[1]||1;return s.map(([cat,amt])=>{const ci=LB_CATS.find(c=>c.key===cat)||{icon:'📎',label:cat,color:'#616161'};const pct=health.totalExpenses>0?Math.round((amt/health.totalExpenses)*100):0;return(<div key={cat} style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontWeight:600,fontSize:'0.9rem'}}>{ci.icon} {ci.label}</span><span style={{fontWeight:700}}>{fmt(amt)} <span style={{fontWeight:400,color:'#888',fontSize:'0.8rem'}}>({pct}%)</span></span></div><div style={{height:12,background:'#f0f0f0',borderRadius:6,overflow:'hidden'}}><div style={{height:'100%',width:`${(amt/mx)*100}%`,background:ci.color,borderRadius:6}}/></div></div>);});})()}</div>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
