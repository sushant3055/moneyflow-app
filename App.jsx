import { useState, useEffect, useRef, useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id:"food",          label:"Food & Dining",    icon:"🍽️", color:"#FF6B6B" },
  { id:"transport",     label:"Transport",         icon:"🚗", color:"#4ECDC4" },
  { id:"shopping",      label:"Shopping",          icon:"🛍️", color:"#45B7D1" },
  { id:"bills",         label:"Bills & Utilities", icon:"⚡", color:"#F7DC6F" },
  { id:"health",        label:"Health",            icon:"💊", color:"#82E0AA" },
  { id:"entertainment", label:"Entertainment",     icon:"🎬", color:"#BB8FCE" },
  { id:"salary",        label:"Salary / Income",  icon:"💰", color:"#58D68D" },
  { id:"education",     label:"Education",         icon:"📚", color:"#F0A500" },
  { id:"investment",    label:"Investment",        icon:"📈", color:"#5DADE2" },
  { id:"other",         label:"Other",             icon:"📦", color:"#AEB6BF" },
];
const TRIP_CATS = [
  { id:"food",     label:"Food",     icon:"🍽️", color:"#FF6B6B" },
  { id:"hotel",    label:"Hotel",    icon:"🏨", color:"#45B7D1" },
  { id:"travel",   label:"Travel",   icon:"✈️",  color:"#4ECDC4" },
  { id:"activity", label:"Activity", icon:"🎡", color:"#BB8FCE" },
  { id:"shopping", label:"Shopping", icon:"🛍️", color:"#F0A500" },
  { id:"fuel",     label:"Fuel",     icon:"⛽", color:"#F7DC6F" },
  { id:"tips",     label:"Tips",     icon:"💁", color:"#82E0AA" },
  { id:"other",    label:"Other",    icon:"📦", color:"#AEB6BF" },
];
const TRIP_ICONS    = ["🏖️","⛰️","🏕️","🌍","🚂","🛺","🏯","🎪","🌴","🗺️","🎭","🤿"];
const TRIP_COLORS   = ["#FF6B6B","#4ECDC4","#45B7D1","#BB8FCE","#F7DC6F","#82E0AA","#F0A500","#FF8C69"];
const MEMBER_AVATARS= ["😀","😎","🧑","👩","🧔","👱","🧕","🤠","👴","👵","🧒","🧑‍💻","🦸","🧙","🤹"];
const ACC_COLORS    = ["#4ECDC4","#45B7D1","#BB8FCE","#F7DC6F","#FF6B6B","#82E0AA","#F0A500","#FF8C69"];
const ACC_ICONS     = ["🏦","💳","🏧","🪙","💵","🏪","🎯","💼","📱","🏠"];
const CURRENCIES    = ["INR ₹","USD $","EUR €","GBP £","JPY ¥","AED د.إ","SGD S$","THB ฿"];
const RECUR_OPTS    = ["none","daily","weekly","monthly","yearly"];
const RECUR_LABELS  = {none:"One-time",daily:"Daily",weekly:"Weekly",monthly:"Monthly",yearly:"Yearly"};
const SIP_TYPES     = [
  {id:"sip",      label:"SIP / MF",        icon:"📈", color:"#5DADE2"},
  {id:"emi",      label:"EMI / Loan",       icon:"🏠", color:"#FF6B6B"},
  {id:"insurance",label:"Insurance",        icon:"🛡️", color:"#82E0AA"},
  {id:"rent",     label:"Rent",             icon:"🏘️", color:"#F0A500"},
  {id:"salary",   label:"Salary Credit",   icon:"💰", color:"#58D68D"},
  {id:"sub",      label:"Subscription",    icon:"📱", color:"#BB8FCE"},
  {id:"utility",  label:"Utility Bill",    icon:"⚡", color:"#F7DC6F"},
  {id:"custom",   label:"Custom",          icon:"🔄", color:"#4ECDC4"},
];
const DEFAULT_ACCS  = [
  { id:"cash",  name:"Cash",      icon:"💵", color:"#F7DC6F", balance:0, type:"cash" },
  { id:"bank1", name:"Main Bank", icon:"🏦", color:"#4ECDC4", balance:0, type:"bank" },
];

const fmt   = (n,sym="₹") => `${sym}${new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Math.abs(n||0))}`;
const fmtS  = (n) => new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Math.abs(n||0));
const today = () => new Date().toISOString().split("T")[0];
const uid   = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const monthLabel = (ym) => { const [y,m]=ym.split("-"); return new Date(y,m-1).toLocaleString("default",{month:"short",year:"numeric"}); };

// ─── Settlement ───────────────────────────────────────────────────────────────
function calcSettlements(members, expenses) {
  const bal={};
  members.forEach(m=>bal[m.id]=0);
  expenses.forEach(ex=>{
    const ids=ex.splitAmong?.length?ex.splitAmong:members.map(m=>m.id);
    const share=ex.amount/ids.length;
    bal[ex.paidBy]=(bal[ex.paidBy]||0)+ex.amount;
    ids.forEach(id=>{ bal[id]=(bal[id]||0)-share; });
  });
  const pos=[],neg=[];
  Object.entries(bal).forEach(([id,v])=>{ if(v>0.5)pos.push({id,v}); else if(v<-0.5)neg.push({id,v:-v}); });
  pos.sort((a,b)=>b.v-a.v); neg.sort((a,b)=>b.v-a.v);
  const out=[];
  let i=0,j=0;
  while(i<pos.length&&j<neg.length){
    const amt=Math.min(pos[i].v,neg[j].v);
    if(amt>0.5) out.push({from:neg[j].id,to:pos[i].id,amount:Math.round(amt)});
    pos[i].v-=amt; neg[j].v-=amt;
    if(pos[i].v<0.5)i++; if(neg[j].v<0.5)j++;
  }
  return {balances:bal,settlements:out};
}

// ─── Parse import text ────────────────────────────────────────────────────────
function parseTxns(text,accId){
  const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
  const out=[];
  for(const line of lines){
    const m=line.match(/(?:(\d{4}-\d{2}-\d{2})\s+)?([+-]?\d+(?:\.\d+)?)\s+(.+)|(.+?)\s+([+-]?\d+(?:\.\d+)?)(?:\s+(.*))?/i);
    if(!m) continue;
    let amount,label,date;
    if(m[1]){date=m[1];amount=parseFloat(m[2]);label=m[3];}
    else if(m[4]){label=m[4];amount=parseFloat(m[5]);date=today();}
    else continue;
    const cat=CATEGORIES.find(c=>label.toLowerCase().includes(c.id))||CATEGORIES[9];
    out.push({id:uid(),date:date||today(),amount:Math.abs(amount),type:amount<0?"expense":"expense",category:cat.id,note:label.trim(),accountId:accId,recurring:"none",tags:[]});
  }
  return out;
}

// ─── Spending insights ────────────────────────────────────────────────────────
function getInsights(transactions, budgets, accounts) {
  const insights=[];
  const now=new Date(); const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const mTxns=transactions.filter(t=>t.date?.startsWith(ym)&&t.type==="expense");
  const total=mTxns.reduce((s,t)=>s+t.amount,0);
  const prevYm=`${now.getFullYear()}-${String(now.getMonth()).padStart(2,"0")}` ;
  const prevTotal=transactions.filter(t=>t.date?.startsWith(prevYm)&&t.type==="expense").reduce((s,t)=>s+t.amount,0);
  if(prevTotal>0){
    const diff=((total-prevTotal)/prevTotal*100).toFixed(0);
    if(diff>20) insights.push({icon:"📈",color:"#FF6B6B",text:`Spending up ${diff}% vs last month`});
    else if(diff<-10) insights.push({icon:"📉",color:"#58D68D",text:`Spending down ${Math.abs(diff)}% vs last month — great!`});
  }
  // Budget alerts
  budgets.forEach(b=>{
    const spent=mTxns.filter(t=>t.category===b.category).reduce((s,t)=>s+t.amount,0);
    const pct=spent/b.limit*100;
    if(pct>=100) insights.push({icon:"🚨",color:"#FF6B6B",text:`${CATEGORIES.find(c=>c.id===b.category)?.label} budget exceeded!`});
    else if(pct>=80) insights.push({icon:"⚠️",color:"#F7DC6F",text:`${CATEGORIES.find(c=>c.id===b.category)?.label} at ${pct.toFixed(0)}% of budget`});
  });
  // Top category
  const byCat={};
  mTxns.forEach(t=>{ byCat[t.category]=(byCat[t.category]||0)+t.amount; });
  const topCat=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
  if(topCat){ const cat=CATEGORIES.find(c=>c.id===topCat[0]); if(cat) insights.push({icon:cat.icon,color:cat.color,text:`${cat.label} is your biggest spend this month`}); }
  // Low balance
  accounts.forEach(a=>{ if(a.balance<500&&a.balance>=0) insights.push({icon:"💸",color:"#FF6B6B",text:`${a.name} balance is low (₹${fmtS(a.balance)})`}); });
  return insights;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const load=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}};

  const [tab,setTab]         = useState("home");
  const [screen,setScreen]   = useState("home");
  const [tripScr,setTripScr] = useState("list");
  const [activeTrip,setActiveTrip] = useState(null);

  const [transactions,setTransactions] = useState(()=>load("txns",[]));
  const [accounts,setAccounts]         = useState(()=>load("accs",DEFAULT_ACCS));
  const [trips,setTrips]               = useState(()=>load("trips",[]));
  const [budgets,setBudgets]           = useState(()=>load("budgets",[]));
  const [recurPlans,setRecurPlans]     = useState(()=>load("recurPlans",[]));
  const [settledIds,setSettledIds]     = useState(()=>load("settled",[]));
  const [toast,setToast]               = useState(null);
  const [filterMonth,setFilterMonth]   = useState(today().slice(0,7));
  const [searchQ,setSearchQ]           = useState("");
  const [filterCat,setFilterCat]       = useState("all");
  const [filterAcc,setFilterAcc]       = useState("all");

  // Forms
  const blankForm={amount:"",type:"expense",category:"food",note:"",date:today(),accountId:"",recurring:"none",tags:""};
  const [form,setForm]   = useState(blankForm);
  const [importText,setImportText] = useState("");
  const [importPrev,setImportPrev] = useState([]);
  const [importAcc,setImportAcc]   = useState("");
  const [editAcc,setEditAcc]       = useState(null);
  const [accForm,setAccForm]       = useState({name:"",icon:"🏦",color:"#4ECDC4",balance:"",type:"bank"});
  const [editBudget,setEditBudget] = useState(null);
  const [budgetForm,setBudgetForm] = useState({category:"food",limit:""});
  const [tripForm,setTripForm]     = useState({name:"",icon:"🏖️",color:"#4ECDC4",date:today(),members:[],currency:"INR ₹"});
  const [memberName,setMemberName] = useState("");
  const [memberAv,setMemberAv]     = useState("😀");
  const [expForm,setExpForm]       = useState({desc:"",amount:"",category:"food",paidBy:"",splitAmong:[],date:today(),note:""});
  const [editTx,setEditTx]         = useState(null);
  const [editRecur,setEditRecur]   = useState(null); // null | "new" | plan obj
  const [recurForm,setRecurForm]   = useState({name:"",sipType:"sip",amount:"",type:"expense",accountId:"",frequency:"monthly",startDate:today(),endDate:"",active:true,note:""});

  const fileRef=useRef();

  useEffect(()=>{localStorage.setItem("txns",JSON.stringify(transactions));},[transactions]);
  useEffect(()=>{localStorage.setItem("accs",JSON.stringify(accounts));},[accounts]);
  useEffect(()=>{localStorage.setItem("trips",JSON.stringify(trips));},[trips]);
  useEffect(()=>{localStorage.setItem("budgets",JSON.stringify(budgets));},[budgets]);
  useEffect(()=>{localStorage.setItem("recurPlans",JSON.stringify(recurPlans));},[recurPlans]);
  useEffect(()=>{localStorage.setItem("settled",JSON.stringify(settledIds));},[settledIds]);
  useEffect(()=>{if(!form.accountId&&accounts.length)setForm(f=>({...f,accountId:accounts[0].id}));},[accounts]);
  useEffect(()=>{if(!importAcc&&accounts.length)setImportAcc(accounts[0].id);},[accounts]);

  // ── Auto-apply recurring plans ────────────────────────────────────────────
  useEffect(()=>{
    const todayStr=today();
    const newTxns=[];
    recurPlans.filter(p=>p.active).forEach(plan=>{
      if(plan.endDate&&plan.endDate<todayStr) return; // expired
      // find last execution date
      const planTxns=transactions.filter(t=>t.recurPlanId===plan.id);
      const lastDate=planTxns.length?planTxns.map(t=>t.date).sort().reverse()[0]:null;
      const refDate=lastDate||plan.startDate;
      if(refDate>todayStr) return; // not started yet
      // compute next due
      let next=new Date(refDate);
      if(plan.frequency==="daily")   next.setDate(next.getDate()+1);
      else if(plan.frequency==="weekly")  next.setDate(next.getDate()+7);
      else if(plan.frequency==="monthly") next.setMonth(next.getMonth()+1);
      else if(plan.frequency==="yearly")  next.setFullYear(next.getFullYear()+1);
      const nextStr=next.toISOString().split("T")[0];
      if(nextStr<=todayStr){
        newTxns.push({id:uid(),date:nextStr,amount:plan.amount,type:plan.type,category:SIP_TYPES.find(s=>s.id===plan.sipType)?.id==="salary"?"salary":"investment",note:plan.name,accountId:plan.accountId,recurring:plan.frequency,recurPlanId:plan.id,tags:["auto","recurring"]});
      }
    });
    if(newTxns.length) setTransactions(p=>[...newTxns,...p]);
  },[recurPlans]);

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),2600);};

  // ── Accounts ──────────────────────────────────────────────────────────────
  const saveAcc=()=>{
    if(!accForm.name.trim()) return showToast("Enter account name","error");
    const bal=parseFloat(accForm.balance)||0;
    if(editAcc==="new"){ setAccounts(p=>[...p,{id:uid(),name:accForm.name.trim(),icon:accForm.icon,color:accForm.color,balance:bal,type:accForm.type}]); showToast("Account added!"); }
    else{ setAccounts(p=>p.map(a=>a.id===editAcc.id?{...a,...accForm,balance:bal}:a)); showToast("Account updated!"); }
    setEditAcc(null);
  };
  const delAcc=(id)=>{ if(accounts.length<=1) return showToast("Need at least one account","error"); setAccounts(p=>p.filter(a=>a.id!==id)); setTransactions(p=>p.filter(t=>t.accountId!==id)); showToast("Deleted","error"); };

  // ── Transactions ──────────────────────────────────────────────────────────
  const saveTx=()=>{
    if(!form.amount||isNaN(parseFloat(form.amount))) return showToast("Enter valid amount","error");
    if(!form.accountId) return showToast("Select an account","error");
    const tx={...form,id:editTx?editTx.id:uid(),amount:parseFloat(form.amount),tags:form.tags?form.tags.split(",").map(t=>t.trim()).filter(Boolean):[]};
    if(editTx) setTransactions(p=>p.map(t=>t.id===editTx.id?tx:t));
    else setTransactions(p=>[tx,...p]);
    setForm(blankForm); setEditTx(null);
    showToast(editTx?"Transaction updated!":"Transaction added!"); setScreen("home");
  };
  const delTx=(id)=>{ setTransactions(p=>p.filter(t=>t.id!==id)); showToast("Deleted","error"); };
  const startEditTx=(t)=>{ setEditTx(t); setForm({...t,tags:(t.tags||[]).join(",")}); setScreen("add"); };

  // ── Transfer between accounts ──────────────────────────────────────────────
  const [xferForm,setXferForm] = useState({from:"",to:"",amount:""});
  const doTransfer=()=>{
    const amt=parseFloat(xferForm.amount);
    if(!amt||isNaN(amt)) return showToast("Enter valid amount","error");
    if(xferForm.from===xferForm.to) return showToast("Select different accounts","error");
    const fromAcc=accounts.find(a=>a.id===xferForm.from);
    if(fromAcc&&fromAcc.balance<amt) return showToast("Insufficient balance","error");
    setAccounts(p=>p.map(a=>{
      if(a.id===xferForm.from) return {...a,balance:a.balance-amt};
      if(a.id===xferForm.to)   return {...a,balance:a.balance+amt};
      return a;
    }));
    const note=`Transfer to ${accounts.find(a=>a.id===xferForm.to)?.name}`;
    setTransactions(p=>[{id:uid(),date:today(),amount:amt,type:"expense",category:"other",note,accountId:xferForm.from,recurring:"none",tags:["transfer"]},{id:uid(),date:today(),amount:amt,type:"income",category:"other",note:`Transfer from ${accounts.find(a=>a.id===xferForm.from)?.name}`,accountId:xferForm.to,recurring:"none",tags:["transfer"]},...p]);
    setXferForm({from:"",to:"",amount:""}); showToast("Transfer done! 💸"); setScreen("home");
  };

  // ── Budgets ───────────────────────────────────────────────────────────────
  const saveBudget=()=>{
    if(!budgetForm.limit||isNaN(parseFloat(budgetForm.limit))) return showToast("Enter valid limit","error");
    if(editBudget==="new"){ setBudgets(p=>[...p,{id:uid(),category:budgetForm.category,limit:parseFloat(budgetForm.limit)}]); showToast("Budget set!"); }
    else{ setBudgets(p=>p.map(b=>b.id===editBudget.id?{...b,...budgetForm,limit:parseFloat(budgetForm.limit)}:b)); showToast("Budget updated!"); }
    setEditBudget(null);
  };
  const delBudget=(id)=>{ setBudgets(p=>p.filter(b=>b.id!==id)); showToast("Budget removed","error"); };

  // ── Recurring Plans ───────────────────────────────────────────────────────
  const blankRecurForm={name:"",sipType:"sip",amount:"",type:"expense",accountId:accounts[0]?.id||"",frequency:"monthly",startDate:today(),endDate:"",active:true,note:""};
  const saveRecurPlan=()=>{
    if(!recurForm.name.trim()) return showToast("Enter plan name","error");
    if(!recurForm.amount||isNaN(parseFloat(recurForm.amount))) return showToast("Enter valid amount","error");
    if(!recurForm.accountId) return showToast("Select an account","error");
    const plan={...recurForm,amount:parseFloat(recurForm.amount),id:editRecur==="new"?uid():editRecur.id};
    if(editRecur==="new"){ setRecurPlans(p=>[plan,...p]); showToast("Plan created! 🔄"); }
    else{ setRecurPlans(p=>p.map(r=>r.id===plan.id?plan:r)); showToast("Plan updated!"); }
    setEditRecur(null);
  };
  const toggleRecurPlan=(id)=>{ setRecurPlans(p=>p.map(r=>r.id===id?{...r,active:!r.active}:r)); };
  const delRecurPlan=(id)=>{ setRecurPlans(p=>p.filter(r=>r.id!==id)); showToast("Plan deleted","error"); };
  const getNextDue=(plan)=>{
    const planTxns=transactions.filter(t=>t.recurPlanId===plan.id);
    const lastDate=planTxns.length?planTxns.map(t=>t.date).sort().reverse()[0]:null;
    const refDate=lastDate||plan.startDate;
    let next=new Date(refDate);
    if(plan.frequency==="daily")   next.setDate(next.getDate()+1);
    else if(plan.frequency==="weekly")  next.setDate(next.getDate()+7);
    else if(plan.frequency==="monthly") next.setMonth(next.getMonth()+1);
    else if(plan.frequency==="yearly")  next.setFullYear(next.getFullYear()+1);
    return next.toISOString().split("T")[0];
  };
  const getTotalPaid=(planId)=>transactions.filter(t=>t.recurPlanId===planId).reduce((s,t)=>s+t.amount,0);
  const getRunCount=(planId)=>transactions.filter(t=>t.recurPlanId===planId).length;

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImportText=(text)=>{ setImportText(text); setImportPrev(parseTxns(text,importAcc||accounts[0]?.id)); };
  const confirmImport=()=>{ if(!importPrev.length) return; setTransactions(p=>[...importPrev,...p]); setImportText(""); setImportPrev([]); showToast(`${importPrev.length} imported!`); setScreen("home"); };
  const handleFile=(e)=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>handleImportText(ev.target.result); r.readAsText(f); };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportCSV=()=>{
    const rows=[["Date","Type","Category","Amount","Account","Note","Tags"],...transactions.map(t=>[t.date,t.type,t.category,t.amount,accounts.find(a=>a.id===t.accountId)?.name||"",t.note,(t.tags||[]).join("|")])];
    const csv=rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`moneyflow_${today()}.csv`; a.click();
    showToast("CSV exported! 📊");
  };

  // ── Trips ─────────────────────────────────────────────────────────────────
  const createTrip=()=>{
    if(!tripForm.name.trim()) return showToast("Enter trip name","error");
    if(tripForm.members.length<2) return showToast("Add at least 2 members","error");
    const t={id:uid(),...tripForm,name:tripForm.name.trim(),expenses:[]};
    setTrips(p=>[t,...p]); setTripForm({name:"",icon:"🏖️",color:"#4ECDC4",date:today(),members:[],currency:"INR ₹"});
    showToast("Trip created! 🎉"); setTripScr("list");
  };
  const openTrip=(trip)=>{ const cur=trips.find(t=>t.id===trip.id)||trip; setActiveTrip(cur); setExpForm({desc:"",amount:"",category:"food",paidBy:cur.members[0]?.id||"",splitAmong:cur.members.map(m=>m.id),date:today(),note:""}); setTripScr("detail"); };
  const addTripExp=()=>{
    if(!expForm.desc.trim()) return showToast("Enter description","error");
    if(!expForm.amount||isNaN(parseFloat(expForm.amount))) return showToast("Enter valid amount","error");
    if(!expForm.paidBy) return showToast("Select who paid","error");
    if(!expForm.splitAmong.length) return showToast("Select who to split with","error");
    const ex={id:uid(),desc:expForm.desc.trim(),amount:parseFloat(expForm.amount),category:expForm.category,paidBy:expForm.paidBy,splitAmong:expForm.splitAmong,date:expForm.date,note:expForm.note};
    setTrips(p=>p.map(t=>t.id===activeTrip.id?{...t,expenses:[...t.expenses,ex]}:t));
    setActiveTrip(t=>({...t,expenses:[...t.expenses,ex]}));
    setExpForm(f=>({...f,desc:"",amount:"",note:""})); showToast("Expense added!"); setTripScr("detail");
  };
  const delTripExp=(eid)=>{ setTrips(p=>p.map(t=>t.id===activeTrip.id?{...t,expenses:t.expenses.filter(e=>e.id!==eid)}:t)); setActiveTrip(t=>({...t,expenses:t.expenses.filter(e=>e.id!==eid)})); };
  const delTrip=(id)=>{ setTrips(p=>p.filter(t=>t.id!==id)); setTripScr("list"); showToast("Trip deleted","error"); };
  const toggleSettled=(key)=>setSettledIds(p=>p.includes(key)?p.filter(k=>k!==key):[...p,key]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalWallet   = accounts.reduce((s,a)=>s+a.balance,0);
  const monthTxns     = transactions.filter(t=>t.date?.startsWith(filterMonth));
  const totalIncome   = monthTxns.filter(t=>t.type==="income").reduce((a,t)=>a+t.amount,0);
  const totalExpense  = monthTxns.filter(t=>t.type==="expense").reduce((a,t)=>a+t.amount,0);
  const netBalance    = totalWallet+totalIncome-totalExpense;

  const filteredTxns = useMemo(()=>{
    return transactions.filter(t=>{
      if(!t.date?.startsWith(filterMonth)) return false;
      if(searchQ&&!t.note?.toLowerCase().includes(searchQ.toLowerCase())&&!(t.tags||[]).some(tg=>tg.toLowerCase().includes(searchQ.toLowerCase()))) return false;
      if(filterCat!=="all"&&t.category!==filterCat) return false;
      if(filterAcc!=="all"&&t.accountId!==filterAcc) return false;
      return true;
    });
  },[transactions,filterMonth,searchQ,filterCat,filterAcc]);

  const catSpend = useMemo(()=>CATEGORIES.map(c=>({...c,total:monthTxns.filter(t=>t.category===c.id&&t.type==="expense").reduce((a,t)=>a+t.amount,0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total),[monthTxns]);
  const maxCat   = Math.max(...catSpend.map(c=>c.total),1);

  // Last 6 months trend
  const trendData = useMemo(()=>{
    const months=[]; const now=new Date();
    for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }
    return months.map(ym=>({ ym, label:monthLabel(ym), exp:transactions.filter(t=>t.date?.startsWith(ym)&&t.type==="expense").reduce((s,t)=>s+t.amount,0), inc:transactions.filter(t=>t.date?.startsWith(ym)&&t.type==="income").reduce((s,t)=>s+t.amount,0) }));
  },[transactions]);
  const maxTrend = Math.max(...trendData.map(d=>Math.max(d.exp,d.inc)),1);

  const insights = useMemo(()=>{
    const base=getInsights(transactions,budgets,accounts);
    // Due today
    const dueToday=recurPlans.filter(p=>p.active&&getNextDue(p)===today());
    if(dueToday.length) base.unshift({icon:"🔔",color:"#4ECDC4",text:`${dueToday.length} recurring payment${dueToday.length>1?"s":""} due today`});
    return base;
  },[transactions,budgets,accounts,recurPlans]);
  const getCat = (id)=>CATEGORIES.find(c=>c.id===id)||CATEGORIES[9];
  const getAcc = (id)=>accounts.find(a=>a.id===id)||accounts[0];
  const getCurSym = (trip)=>(trip?.currency||"INR ₹").split(" ")[1]||"₹";

  // ── Titles ────────────────────────────────────────────────────────────────
  const pTitle={home:"💸 MoneyFlow",add:editTx?"Edit Transaction":"Add Transaction",import:"Import",wallets:"Wallets & Banks",history:"History",stats:"Analytics",budgets:"Budgets",transfer:"Transfer Funds",recurring:"Recurring & SIPs"}[screen]||"MoneyFlow";

  // ── Account Editor ────────────────────────────────────────────────────────
  if(editAcc!==null) return (
    <Wrapper>
      <Hdr left={<BkBtn onClick={()=>setEditAcc(null)}/>} title={editAcc==="new"?"Add Account":"Edit Account"}/>
      <Scroll h="calc(100vh - 100px)">
        <div style={S.card}>
          <div style={{...S.previewCard,background:accForm.color+"18",borderColor:accForm.color+"44",marginBottom:16}}>
            <span style={{fontSize:28}}>{accForm.icon}</span>
            <div style={{marginLeft:12,flex:1}}><div style={{color:"#fff",fontWeight:700}}>{accForm.name||"Account Name"}</div><div style={{color:accForm.color,fontSize:13}}>{fmt(parseFloat(accForm.balance)||0,"")}₹</div></div>
            <Tag color={accForm.color}>{accForm.type==="cash"?"CASH":"BANK"}</Tag>
          </div>
          <FL>Name</FL><input value={accForm.name} onChange={e=>setAccForm(f=>({...f,name:e.target.value}))} placeholder="e.g. HDFC Savings" style={S.inp}/>
          <FL>Type</FL>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            {["bank","cash"].map(tp=><button key={tp} onClick={()=>setAccForm(f=>({...f,type:tp,icon:tp==="cash"?"💵":f.icon}))} style={{flex:1,padding:"10px",borderRadius:12,cursor:"pointer",fontWeight:700,fontSize:13,background:accForm.type===tp?(tp==="cash"?"#F7DC6F22":"#4ECDC422"):"transparent",border:`2px solid ${tp==="cash"?"#F7DC6F":"#4ECDC4"}`,color:accForm.type===tp?"#fff":"#666"}}>{tp==="cash"?"💵 Cash":"🏦 Bank"}</button>)}
          </div>
          <FL>Balance (₹)</FL><AmtInput value={accForm.balance} onChange={v=>setAccForm(f=>({...f,balance:v}))} sym="₹"/>
          <FL>Icon</FL><IconGrid icons={ACC_ICONS} selected={accForm.icon} onSelect={ic=>setAccForm(f=>({...f,icon:ic}))} color={accForm.color}/>
          <FL>Color</FL><ColorGrid colors={ACC_COLORS} selected={accForm.color} onSelect={c=>setAccForm(f=>({...f,color:c}))}/>
          <Btn onClick={saveAcc}>{editAcc==="new"?"Add Account":"Save Changes"}</Btn>
          {editAcc!=="new"&&<Btn onClick={()=>{delAcc(editAcc.id);setEditAcc(null);}} style={{marginTop:10,background:"transparent",border:"2px solid #FF6B6B44",color:"#FF6B6B"}}>🗑 Delete Account</Btn>}
        </div>
      </Scroll>
      {toast&&<Toast t={toast}/>}
    </Wrapper>
  );

  // ── Recurring Plan Editor ─────────────────────────────────────────────────
  if(editRecur!==null) return (
    <Wrapper>
      <Hdr left={<BkBtn onClick={()=>setEditRecur(null)}/>} title={editRecur==="new"?"New Recurring Plan":"Edit Plan"}/>
      <Scroll h="calc(100vh - 100px)">
        <div style={S.card}>
          {/* Live preview */}
          {(()=>{const st=SIP_TYPES.find(s=>s.id===recurForm.sipType)||SIP_TYPES[7]; return (
            <div style={{background:st.color+"18",borderRadius:18,padding:"16px",marginBottom:16,border:`1px solid ${st.color}44`,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:50,height:50,borderRadius:16,background:st.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{st.icon}</div>
              <div style={{flex:1}}>
                <div style={{color:"#fff",fontWeight:800,fontSize:16}}>{recurForm.name||"Plan Name"}</div>
                <div style={{color:st.color,fontSize:13,marginTop:2}}>₹{fmtS(parseFloat(recurForm.amount)||0)} · {recurForm.frequency}</div>
                <div style={{color:"#666",fontSize:11,marginTop:1}}>{recurForm.startDate}{recurForm.endDate?` → ${recurForm.endDate}`:""}</div>
              </div>
              <div style={{background:recurForm.active?"#58D68D22":"#FF6B6B22",borderRadius:10,padding:"4px 10px"}}>
                <span style={{color:recurForm.active?"#58D68D":"#FF6B6B",fontSize:11,fontWeight:700}}>{recurForm.active?"ACTIVE":"PAUSED"}</span>
              </div>
            </div>
          );})()}

          <FL>Plan Name</FL>
          <input value={recurForm.name} onChange={e=>setRecurForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Axis SIP, Home Loan EMI" style={S.inp}/>

          <FL>Plan Type</FL>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
            {SIP_TYPES.map(st=>(
              <button key={st.id} onClick={()=>setRecurForm(f=>({...f,sipType:st.id,type:st.id==="salary"?"income":"expense"}))}
                style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 4px",borderRadius:14,cursor:"pointer",background:recurForm.sipType===st.id?st.color:st.color+"18",border:`2px solid ${recurForm.sipType===st.id?st.color:"transparent"}`,color:recurForm.sipType===st.id?"#fff":st.color}}>
                <span style={{fontSize:18}}>{st.icon}</span>
                <span style={{fontSize:9,marginTop:2,textAlign:"center"}}>{st.label}</span>
              </button>
            ))}
          </div>

          <FL>Transaction Type</FL>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            {["expense","income"].map(tp=>(
              <button key={tp} onClick={()=>setRecurForm(f=>({...f,type:tp}))}
                style={{flex:1,padding:"10px",borderRadius:12,cursor:"pointer",fontWeight:700,fontSize:13,background:recurForm.type===tp?(tp==="expense"?"#FF6B6B":"#58D68D"):"transparent",border:`2px solid ${tp==="expense"?"#FF6B6B":"#58D68D"}`,color:recurForm.type===tp?"#fff":"#666"}}>
                {tp==="expense"?"↓ Debit":"↑ Credit"}
              </button>
            ))}
          </div>

          <FL>Amount (₹)</FL>
          <AmtInput value={recurForm.amount} onChange={v=>setRecurForm(f=>({...f,amount:v}))} sym="₹" large/>

          <FL>Bank / Wallet Account</FL>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {accounts.map(acc=>(
              <button key={acc.id} onClick={()=>setRecurForm(f=>({...f,accountId:acc.id}))}
                style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:12,cursor:"pointer",background:recurForm.accountId===acc.id?acc.color+"30":"#1a1a1a",border:`2px solid ${recurForm.accountId===acc.id?acc.color:"#2a2a2a"}`,color:recurForm.accountId===acc.id?acc.color:"#888",fontWeight:600,fontSize:13}}>
                <span>{acc.icon}</span>{acc.name}
              </button>
            ))}
          </div>

          <FL>Frequency</FL>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {["daily","weekly","monthly","yearly"].map(fr=>(
              <button key={fr} onClick={()=>setRecurForm(f=>({...f,frequency:fr}))}
                style={{padding:"8px 14px",borderRadius:12,cursor:"pointer",fontWeight:700,fontSize:13,background:recurForm.frequency===fr?"#4ECDC422":"#1a1a1a",border:`2px solid ${recurForm.frequency===fr?"#4ECDC4":"#2a2a2a"}`,color:recurForm.frequency===fr?"#4ECDC4":"#888"}}>
                {fr.charAt(0).toUpperCase()+fr.slice(1)}
              </button>
            ))}
          </div>

          <FL>Start Date</FL>
          <input type="date" value={recurForm.startDate} onChange={e=>setRecurForm(f=>({...f,startDate:e.target.value}))} style={S.inp}/>

          <FL>End Date (optional — leave blank for indefinite)</FL>
          <input type="date" value={recurForm.endDate} onChange={e=>setRecurForm(f=>({...f,endDate:e.target.value}))} style={S.inp}/>

          <FL>Note (optional)</FL>
          <input value={recurForm.note} onChange={e=>setRecurForm(f=>({...f,note:e.target.value}))} placeholder="e.g. Axis Bluechip Fund, HDFC Home Loan" style={S.inp}/>

          <FL>Status</FL>
          <button onClick={()=>setRecurForm(f=>({...f,active:!f.active}))}
            style={{width:"100%",padding:"12px",borderRadius:14,cursor:"pointer",fontWeight:700,fontSize:14,marginBottom:16,background:recurForm.active?"#58D68D22":"#FF6B6B22",border:`2px solid ${recurForm.active?"#58D68D":"#FF6B6B"}`,color:recurForm.active?"#58D68D":"#FF6B6B"}}>
            {recurForm.active?"✅ Active — tap to pause":"⏸ Paused — tap to activate"}
          </button>

          <Btn onClick={saveRecurPlan}>{editRecur==="new"?"Create Plan":"Save Changes"}</Btn>
          {editRecur!=="new"&&(
            <Btn onClick={()=>{delRecurPlan(editRecur.id);setEditRecur(null);}} style={{marginTop:10,background:"transparent",border:"2px solid #FF6B6B44",color:"#FF6B6B"}}>🗑 Delete Plan</Btn>
          )}
        </div>
      </Scroll>
      {toast&&<Toast t={toast}/>}
    </Wrapper>
  );

  // ── Budget Editor ─────────────────────────────────────────────────────────
  if(editBudget!==null) return (
    <Wrapper>
      <Hdr left={<BkBtn onClick={()=>setEditBudget(null)}/>} title={editBudget==="new"?"Set Budget":"Edit Budget"}/>
      <Scroll h="calc(100vh - 100px)">
        <div style={S.card}>
          <FL>Category</FL>
          <div style={S.catGrid}>
            {CATEGORIES.filter(c=>c.id!=="salary").map(c=><button key={c.id} onClick={()=>setBudgetForm(f=>({...f,category:c.id}))} style={{...S.catBtn,background:budgetForm.category===c.id?c.color:c.color+"18",border:`2px solid ${budgetForm.category===c.id?c.color:"transparent"}`,color:budgetForm.category===c.id?"#fff":c.color}}><span style={{fontSize:18}}>{c.icon}</span><span style={{fontSize:9,marginTop:2}}>{c.label.split(" ")[0]}</span></button>)}
          </div>
          <FL>Monthly Limit (₹)</FL><AmtInput value={budgetForm.limit} onChange={v=>setBudgetForm(f=>({...f,limit:v}))} sym="₹"/>
          <Btn onClick={saveBudget}>{editBudget==="new"?"Set Budget":"Update Budget"}</Btn>
          {editBudget!=="new"&&<Btn onClick={()=>{delBudget(editBudget.id);setEditBudget(null);}} style={{marginTop:10,background:"transparent",border:"2px solid #FF6B6B44",color:"#FF6B6B"}}>🗑 Remove Budget</Btn>}
        </div>
      </Scroll>
      {toast&&<Toast t={toast}/>}
    </Wrapper>
  );

  // ── TRIP: New trip ────────────────────────────────────────────────────────
  if(tab==="trips"&&tripScr==="addTrip") return (
    <Wrapper>
      <Hdr left={<BkBtn onClick={()=>setTripScr("list")}/>} title="New Trip"/>
      <Scroll h="calc(100vh - 100px)">
        <div style={S.card}>
          <div style={{background:tripForm.color+"18",borderRadius:18,padding:"16px",textAlign:"center",marginBottom:16,border:`1px solid ${tripForm.color}44`}}>
            <div style={{fontSize:44}}>{tripForm.icon}</div>
            <div style={{color:"#fff",fontWeight:800,fontSize:18,marginTop:6}}>{tripForm.name||"Trip Name"}</div>
            <div style={{color:tripForm.color,fontSize:12,marginTop:2}}>{tripForm.date} · {tripForm.members.length} members</div>
          </div>
          <FL>Trip Name</FL><input value={tripForm.name} onChange={e=>setTripForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Goa 2024" style={S.inp}/>
          <FL>Start Date</FL><input type="date" value={tripForm.date} onChange={e=>setTripForm(f=>({...f,date:e.target.value}))} style={S.inp}/>
          <FL>Currency</FL>
          <select value={tripForm.currency} onChange={e=>setTripForm(f=>({...f,currency:e.target.value}))} style={{...S.inp,marginBottom:14}}>
            {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <FL>Icon</FL><IconGrid icons={TRIP_ICONS} selected={tripForm.icon} onSelect={ic=>setTripForm(f=>({...f,icon:ic}))} color={tripForm.color}/>
          <FL>Color</FL><ColorGrid colors={TRIP_COLORS} selected={tripForm.color} onSelect={c=>setTripForm(f=>({...f,color:c}))}/>
        </div>
        <div style={S.card}>
          <FL>Members ({tripForm.members.length})</FL>
          {tripForm.members.map(m=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #1a1a1a"}}>
              <span style={{fontSize:22}}>{m.avatar}</span>
              <span style={{color:"#fff",flex:1,fontSize:15,fontWeight:600}}>{m.name}</span>
              <button onClick={()=>setTripForm(f=>({...f,members:f.members.filter(x=>x.id!==m.id)}))} style={{background:"#FF6B6B18",border:"none",color:"#FF6B6B",borderRadius:8,padding:"4px 10px",cursor:"pointer"}}>✕</button>
            </div>
          ))}
          <div style={{marginTop:14}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {MEMBER_AVATARS.map(av=><button key={av} onClick={()=>setMemberAv(av)} style={{width:34,height:34,borderRadius:10,fontSize:18,background:memberAv===av?"#4ECDC422":"#1a1a1a",border:`2px solid ${memberAv===av?"#4ECDC4":"#2a2a2a"}`,cursor:"pointer"}}>{av}</button>)}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input value={memberName} onChange={e=>setMemberName(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&memberName.trim()){ setTripForm(f=>({...f,members:[...f.members,{id:uid(),name:memberName.trim(),avatar:memberAv}]})); setMemberName(""); }}} placeholder="Member name" style={{...S.inp,marginBottom:0,flex:1}}/>
              <button onClick={()=>{ if(!memberName.trim()) return; setTripForm(f=>({...f,members:[...f.members,{id:uid(),name:memberName.trim(),avatar:memberAv}]})); setMemberName(""); }} style={{background:"#4ECDC4",border:"none",borderRadius:12,padding:"0 16px",color:"#000",fontWeight:800,cursor:"pointer",fontSize:20}}>+</button>
            </div>
          </div>
        </div>
        <div style={{padding:"0 16px 30px"}}><Btn onClick={createTrip}>🚀 Create Trip</Btn></div>
      </Scroll>
      {toast&&<Toast t={toast}/>}
    </Wrapper>
  );

  // ── TRIP: Add expense ─────────────────────────────────────────────────────
  if(tab==="trips"&&tripScr==="addExpense"&&activeTrip) return (
    <Wrapper>
      <Hdr left={<BkBtn onClick={()=>setTripScr("detail")}/>} title="Add Expense"/>
      <Scroll h="calc(100vh - 100px)">
        <div style={S.card}>
          <FL>Description</FL><input value={expForm.desc} onChange={e=>setExpForm(f=>({...f,desc:e.target.value}))} placeholder="e.g. Dinner at beach shack" style={S.inp}/>
          <FL>Amount ({getCurSym(activeTrip)})</FL><AmtInput value={expForm.amount} onChange={v=>setExpForm(f=>({...f,amount:v}))} sym={getCurSym(activeTrip)}/>
          <FL>Note (optional)</FL><input value={expForm.note} onChange={e=>setExpForm(f=>({...f,note:e.target.value}))} placeholder="Any details..." style={S.inp}/>
          <FL>Category</FL>
          <div style={S.catGrid}>
            {TRIP_CATS.map(c=><button key={c.id} onClick={()=>setExpForm(f=>({...f,category:c.id}))} style={{...S.catBtn,background:expForm.category===c.id?c.color:c.color+"18",border:`2px solid ${expForm.category===c.id?c.color:"transparent"}`,color:expForm.category===c.id?"#fff":c.color}}><span style={{fontSize:18}}>{c.icon}</span><span style={{fontSize:9,marginTop:2}}>{c.label}</span></button>)}
          </div>
          <FL>Date</FL><input type="date" value={expForm.date} onChange={e=>setExpForm(f=>({...f,date:e.target.value}))} style={S.inp}/>
        </div>
        <div style={S.card}>
          <FL>Paid by</FL>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {activeTrip.members.map(m=><button key={m.id} onClick={()=>setExpForm(f=>({...f,paidBy:m.id}))} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:12,cursor:"pointer",background:expForm.paidBy===m.id?activeTrip.color+"30":"#1a1a1a",border:`2px solid ${expForm.paidBy===m.id?activeTrip.color:"#2a2a2a"}`,color:expForm.paidBy===m.id?"#fff":"#888",fontWeight:600,fontSize:13}}><span>{m.avatar}</span>{m.name}</button>)}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <FL>Split among</FL>
            <button onClick={()=>setExpForm(f=>({...f,splitAmong:activeTrip.members.map(m=>m.id)}))} style={{background:"none",border:"none",color:"#4ECDC4",fontSize:12,cursor:"pointer"}}>Select all</button>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {activeTrip.members.map(m=>{ const sel=expForm.splitAmong.includes(m.id); return <button key={m.id} onClick={()=>setExpForm(f=>({...f,splitAmong:sel?f.splitAmong.filter(id=>id!==m.id):[...f.splitAmong,m.id]}))} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:12,cursor:"pointer",background:sel?"#58D68D22":"#1a1a1a",border:`2px solid ${sel?"#58D68D":"#2a2a2a"}`,color:sel?"#58D68D":"#888",fontWeight:600,fontSize:13}}><span>{m.avatar}</span>{m.name}{sel&&<span style={{fontSize:10}}>✓</span>}</button>; })}
          </div>
          {expForm.splitAmong.length>0&&expForm.amount&&(
            <div style={{background:"#1a2a1a",borderRadius:10,padding:"10px 12px",marginTop:12,color:"#82E0AA",fontSize:12}}>
              Each pays: <strong>{getCurSym(activeTrip)}{fmtS(parseFloat(expForm.amount)/expForm.splitAmong.length)}</strong> ({expForm.splitAmong.length} people)
            </div>
          )}
        </div>
        <div style={{padding:"0 16px 30px"}}><Btn onClick={addTripExp}>Add Expense</Btn></div>
      </Scroll>
      {toast&&<Toast t={toast}/>}
    </Wrapper>
  );

  // ── TRIP: Settle ──────────────────────────────────────────────────────────
  if(tab==="trips"&&tripScr==="settle"&&activeTrip){
    const cur=trips.find(t=>t.id===activeTrip.id)||activeTrip;
    const {balances,settlements}=calcSettlements(cur.members,cur.expenses);
    const gm=(id)=>cur.members.find(m=>m.id===id)||{name:"?",avatar:"❓"};
    const sym=getCurSym(cur);
    const totalSpend=cur.expenses.reduce((s,e)=>s+e.amount,0);
    return (
      <Wrapper>
        <Hdr left={<BkBtn onClick={()=>setTripScr("detail")}/>} title="Settle Up"/>
        <Scroll h="calc(100vh - 100px)">
          <div style={{margin:16,background:cur.color+"15",borderRadius:20,padding:18,border:`1px solid ${cur.color}44`,textAlign:"center"}}>
            <div style={{fontSize:36}}>{cur.icon}</div>
            <div style={{color:"#fff",fontWeight:800,fontSize:18,marginTop:6}}>{cur.name}</div>
            <div style={{color:cur.color,fontSize:26,fontWeight:900,marginTop:4}}>{sym}{fmtS(totalSpend)}</div>
            <div style={{color:"#888",fontSize:12,marginTop:2}}>Total · {cur.members.length} members · {cur.expenses.length} expenses</div>
            <div style={{color:"#888",fontSize:11,marginTop:2}}>Currency: {cur.currency||"INR ₹"}</div>
          </div>
          <div style={{padding:"0 16px 8px"}}>
            <div style={S.secTitle}>Who owes what</div>
            {cur.members.map(m=>{ const b=balances[m.id]||0; return (
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#141414",borderRadius:14,marginBottom:8,border:`1px solid ${b>0?"#58D68D33":b<0?"#FF6B6B33":"#222"}`}}>
                <span style={{fontSize:26}}>{m.avatar}</span>
                <div style={{flex:1}}>
                  <div style={{color:"#fff",fontWeight:700,fontSize:15}}>{m.name}</div>
                  <div style={{color:"#666",fontSize:11,marginTop:2}}>Paid: {sym}{fmtS(cur.expenses.filter(e=>e.paidBy===m.id).reduce((s,e)=>s+e.amount,0))}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{color:b>0?"#58D68D":b<0?"#FF6B6B":"#666",fontWeight:800,fontSize:16}}>{b>0?"+":""}{sym}{fmtS(b)}</div>
                  <div style={{color:"#666",fontSize:10,marginTop:2}}>{b>0?"gets back":b<0?"owes":"settled"}</div>
                </div>
              </div>
            );})}
          </div>
          <div style={{padding:"8px 16px 30px"}}>
            <div style={S.secTitle}>Payments to make</div>
            {settlements.length===0&&<div style={S.empty}>Everyone is settled! 🎉</div>}
            {settlements.map(s=>{ const key=`${cur.id}_${s.from}_${s.to}_${s.amount}`; const done=settledIds.includes(key); const fr=gm(s.from),to=gm(s.to); return (
              <div key={key} style={{padding:"14px",background:done?"#141414":"#0f1f0f",borderRadius:16,marginBottom:10,border:`1px solid ${done?"#222":"#1e3a1e"}`,opacity:done?0.5:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:24}}>{fr.avatar}</span>
                  <div style={{flex:1}}>
                    <div style={{color:"#fff",fontWeight:700,fontSize:14}}><span style={{color:"#FF6B6B"}}>{fr.name}</span><span style={{color:"#666"}}> pays </span><span style={{color:"#58D68D"}}>{to.name}</span></div>
                    <div style={{color:"#82E0AA",fontWeight:900,fontSize:20,marginTop:2}}>{sym}{fmtS(s.amount)}</div>
                  </div>
                  <span style={{fontSize:24}}>{to.avatar}</span>
                </div>
                <button onClick={()=>toggleSettled(key)} style={{width:"100%",marginTop:12,background:done?"#2a2a2a":"#58D68D22",border:`1px solid ${done?"#333":"#58D68D44"}`,borderRadius:12,padding:"9px",color:done?"#666":"#58D68D",fontWeight:700,cursor:"pointer",fontSize:13}}>{done?"✓ Marked as paid":"Mark as paid"}</button>
              </div>
            );})}
          </div>
        </Scroll>
        {toast&&<Toast t={toast}/>}
      </Wrapper>
    );
  }

  // ── TRIP: Detail ──────────────────────────────────────────────────────────
  if(tab==="trips"&&tripScr==="detail"&&activeTrip){
    const cur=trips.find(t=>t.id===activeTrip.id)||activeTrip;
    const totalSpend=cur.expenses.reduce((s,e)=>s+e.amount,0);
    const {settlements}=calcSettlements(cur.members,cur.expenses);
    const pending=settlements.filter(s=>!settledIds.includes(`${cur.id}_${s.from}_${s.to}_${s.amount}`)).length;
    const gm=(id)=>cur.members.find(m=>m.id===id)||{name:"?",avatar:"❓"};
    const gtc=(id)=>TRIP_CATS.find(c=>c.id===id)||TRIP_CATS[7];
    const sym=getCurSym(cur);
    const byCat=TRIP_CATS.map(c=>({...c,total:cur.expenses.filter(e=>e.category===c.id).reduce((s,e)=>s+e.amount,0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);
    return (
      <Wrapper>
        <Hdr left={<BkBtn onClick={()=>setTripScr("list")}/>} title={`${cur.icon} ${cur.name}`} right={<button onClick={()=>delTrip(cur.id)} style={{background:"none",border:"none",color:"#FF6B6B",fontSize:18,cursor:"pointer"}}>🗑</button>}/>
        <Scroll h="calc(100vh - 100px)">
          {/* Hero */}
          <div style={{margin:16,borderRadius:22,padding:"20px",background:`linear-gradient(140deg,${cur.color}22,#0a0a0a)`,border:`1px solid ${cur.color}44`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{color:cur.color,fontSize:11,fontWeight:700,letterSpacing:1}}>TOTAL SPENT</div>
                <div style={{color:"#fff",fontSize:30,fontWeight:900,marginTop:4}}>{sym}{fmtS(totalSpend)}</div>
                <div style={{color:"#888",fontSize:12,marginTop:4}}>{cur.date} · {cur.currency||"INR ₹"}</div>
                <div style={{color:"#888",fontSize:12}}>{cur.members.length} members · {cur.expenses.length} expenses</div>
              </div>
              <span style={{fontSize:44}}>{cur.icon}</span>
            </div>
            <div style={{display:"flex",gap:0,marginTop:12,flexWrap:"wrap"}}>
              {cur.members.map((m,i)=><div key={m.id} title={m.name} style={{width:32,height:32,borderRadius:"50%",background:"#1a1a1a",border:`2px solid ${cur.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,marginLeft:i===0?0:-8}}>{m.avatar}</div>)}
              <div style={{marginLeft:14,color:"#aaa",fontSize:11,alignSelf:"center",flexShrink:0}}>{cur.members.map(m=>m.name).join(", ")}</div>
            </div>
          </div>

          {/* Settle banner */}
          {pending>0&&<button onClick={()=>{setActiveTrip(cur);setTripScr("settle");}} style={{margin:"0 16px 14px",width:"calc(100% - 32px)",background:"#0f1f0f",border:"1px solid #2a4a2a",borderRadius:16,padding:"14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <span style={{fontSize:22}}>💸</span><div style={{flex:1,textAlign:"left"}}><div style={{color:"#82E0AA",fontWeight:700,fontSize:14}}>Settle Up</div><div style={{color:"#666",fontSize:11,marginTop:1}}>{pending} payment{pending>1?"s":""} pending</div></div><span style={{color:"#82E0AA",fontSize:18}}>›</span>
          </button>}
          {pending===0&&cur.expenses.length>0&&<button onClick={()=>{setActiveTrip(cur);setTripScr("settle");}} style={{margin:"0 16px 14px",width:"calc(100% - 32px)",background:"#0f1a0f",border:"1px solid #1e3a1e",borderRadius:16,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <span style={{fontSize:20}}>✅</span><div style={{flex:1,textAlign:"left"}}><div style={{color:"#58D68D",fontWeight:700,fontSize:14}}>All settled!</div></div><span style={{color:"#58D68D",fontSize:18}}>›</span>
          </button>}

          {/* Per-member spend */}
          {cur.expenses.length>0&&(
            <div style={{padding:"0 16px 14px"}}>
              <div style={S.secTitle}>Per person spend</div>
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
                {cur.members.map(m=>{ const paid=cur.expenses.filter(e=>e.paidBy===m.id).reduce((s,e)=>s+e.amount,0); const share=cur.expenses.reduce((s,e)=>{ const ids=e.splitAmong?.length?e.splitAmong:cur.members.map(x=>x.id); return ids.includes(m.id)?s+e.amount/ids.length:s; },0); return (
                  <div key={m.id} style={{flexShrink:0,background:"#141414",borderRadius:14,padding:"12px",minWidth:110,border:`1px solid ${cur.color}33`}}>
                    <div style={{fontSize:24,textAlign:"center"}}>{m.avatar}</div>
                    <div style={{color:"#fff",fontWeight:700,fontSize:12,textAlign:"center",marginTop:4}}>{m.name}</div>
                    <div style={{color:cur.color,fontWeight:800,fontSize:13,textAlign:"center",marginTop:2}}>{sym}{fmtS(share)}</div>
                    <div style={{color:"#666",fontSize:10,textAlign:"center"}}>paid {sym}{fmtS(paid)}</div>
                  </div>
                );})}
              </div>
            </div>
          )}

          {/* Category breakdown */}
          {byCat.length>0&&(
            <div style={{padding:"0 16px 14px"}}>
              <div style={S.secTitle}>Breakdown</div>
              {byCat.map(c=>(
                <div key={c.id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#fff",fontSize:13}}>{c.icon} {c.label}</span><span style={{color:c.color,fontWeight:700,fontSize:13}}>{sym}{fmtS(c.total)}</span></div>
                  <div style={{height:7,background:"#2a2a2a",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${(c.total/totalSpend)*100}%`,background:c.color,borderRadius:99}}/></div>
                </div>
              ))}
            </div>
          )}

          {/* Expenses list */}
          <div style={{padding:"0 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={S.secTitle}>Expenses</span>
              <button onClick={()=>{setActiveTrip(cur);setExpForm({desc:"",amount:"",category:"food",paidBy:cur.members[0]?.id||"",splitAmong:cur.members.map(m=>m.id),date:today(),note:""});setTripScr("addExpense");}} style={{background:cur.color+"22",border:`1px solid ${cur.color}44`,borderRadius:12,padding:"6px 14px",color:cur.color,fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Add</button>
            </div>
            {cur.expenses.length===0&&<div style={S.empty}>No expenses yet. Add the first one!</div>}
            {[...cur.expenses].reverse().map(ex=>{ const payer=gm(ex.paidBy); const tc=gtc(ex.category); const pp=ex.amount/(ex.splitAmong?.length||cur.members.length); return (
              <div key={ex.id} style={{background:"#141414",borderRadius:16,padding:"14px",marginBottom:10,border:"1px solid #1e1e1e"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:40,height:40,borderRadius:12,background:tc.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{tc.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{color:"#fff",fontWeight:700,fontSize:14}}>{ex.desc}</div>
                    {ex.note&&<div style={{color:"#666",fontSize:11,marginTop:1}}>{ex.note}</div>}
                    <div style={{color:"#666",fontSize:11,marginTop:2}}>{ex.date} · {payer.avatar} {payer.name} paid</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{color:"#fff",fontWeight:800,fontSize:16}}>{sym}{fmtS(ex.amount)}</div>
                    <div style={{color:"#888",fontSize:10,marginTop:1}}>{sym}{fmtS(pp)}/each</div>
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,paddingTop:10,borderTop:"1px solid #1e1e1e"}}>
                  <div style={{display:"flex",gap:4}}>{(ex.splitAmong?.length?ex.splitAmong:cur.members.map(m=>m.id)).map(id=>{ const mem=gm(id); return <span key={id} title={mem.name} style={{fontSize:16}}>{mem.avatar}</span>; })}</div>
                  <button onClick={()=>delTripExp(ex.id)} style={{background:"#FF6B6B18",border:"none",color:"#FF6B6B",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12}}>Remove</button>
                </div>
              </div>
            );})}
          </div>
          <div style={{height:20}}/>
        </Scroll>
        {toast&&<Toast t={toast}/>}
      </Wrapper>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN APP
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <Wrapper>
      {/* Tab bar */}
      <div style={S.tabBar}>
        <button onClick={()=>{setTab("home");setScreen("home");}} style={{...S.tabBtn,borderBottom:tab==="home"?"3px solid #4ECDC4":"3px solid transparent",color:tab==="home"?"#4ECDC4":"#555"}}>
          <span style={{fontSize:15}}>💸</span><span style={{fontSize:10,fontWeight:700}}>Personal</span>
        </button>
        <button onClick={()=>{setTab("trips");setTripScr("list");}} style={{...S.tabBtn,borderBottom:tab==="trips"?"3px solid #FF8C69":"3px solid transparent",color:tab==="trips"?"#FF8C69":"#555"}}>
          <span style={{fontSize:15}}>✈️</span><span style={{fontSize:10,fontWeight:700}}>Trips</span>
          {trips.length>0&&<span style={{background:"#FF8C69",color:"#000",borderRadius:99,fontSize:9,fontWeight:800,padding:"1px 5px",marginLeft:3}}>{trips.length}</span>}
        </button>
      </div>

      {/* ═══ PERSONAL TAB ═══════════════════════════════════════════════════ */}
      {tab==="home"&&(<>
        <Hdr
          left={screen!=="home"?<BkBtn onClick={()=>{setScreen("home");setEditTx(null);setForm(blankForm);}}/>:<div style={{width:36}}/>}
          title={pTitle}
          right={screen==="home"?<button onClick={exportCSV} style={{background:"none",border:"none",color:"#555",fontSize:18,cursor:"pointer"}} title="Export CSV">⬇️</button>:<div style={{width:36}}/>}
        />

        {/* HOME SCREEN */}
        {screen==="home"&&(
          <Scroll>
            {/* Insights banner */}
            {insights.length>0&&(
              <div style={{margin:"12px 16px 0",display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
                {insights.slice(0,3).map((ins,i)=>(
                  <div key={i} style={{flexShrink:0,background:ins.color+"15",border:`1px solid ${ins.color}33`,borderRadius:14,padding:"8px 12px",display:"flex",alignItems:"center",gap:8,minWidth:200}}>
                    <span style={{fontSize:18}}>{ins.icon}</span>
                    <span style={{color:ins.color,fontSize:11,fontWeight:600,lineHeight:1.4}}>{ins.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Hero */}
            <div style={S.hero}>
              <div style={S.heroLabel}>TOTAL NET BALANCE</div>
              <div style={S.heroAmt}>{fmt(netBalance)}</div>
              <div style={S.heroRow}>
                <div style={S.heroStat}><span style={{color:"#58D68D",fontSize:11}}>↑ Income</span><span style={{color:"#58D68D",fontWeight:800,fontSize:14}}>{fmt(totalIncome)}</span></div>
                <div style={{width:1,background:"rgba(255,255,255,0.1)",alignSelf:"stretch"}}/>
                <div style={S.heroStat}><span style={{color:"#FF6B6B",fontSize:11}}>↓ Expense</span><span style={{color:"#FF6B6B",fontWeight:800,fontSize:14}}>{fmt(totalExpense)}</span></div>
                <div style={{width:1,background:"rgba(255,255,255,0.1)",alignSelf:"stretch"}}/>
                <div style={S.heroStat}><span style={{color:"#4ECDC4",fontSize:11}}>🏦 Wallet</span><span style={{color:"#4ECDC4",fontWeight:800,fontSize:14}}>{fmt(totalWallet)}</span></div>
              </div>
            </div>

            {/* Account chips */}
            <div style={{paddingLeft:16,paddingBottom:4}}>
              <div style={{display:"flex",gap:10,overflowX:"auto",paddingRight:16,paddingBottom:8}}>
                {accounts.map(acc=>(
                  <button key={acc.id} onClick={()=>{setAccForm({name:acc.name,icon:acc.icon,color:acc.color,balance:acc.balance.toString(),type:acc.type});setEditAcc(acc);}} style={{display:"flex",alignItems:"center",flexShrink:0,padding:"10px 14px",borderRadius:16,border:`1px solid ${acc.color}44`,cursor:"pointer",minWidth:130,background:acc.color+"18"}}>
                    <span style={{fontSize:22}}>{acc.icon}</span>
                    <div style={{marginLeft:8,textAlign:"left"}}><div style={{color:"#888",fontSize:10,fontWeight:600}}>{acc.name}</div><div style={{color:acc.color,fontWeight:800,fontSize:14}}>{fmt(acc.balance)}</div></div>
                  </button>
                ))}
                <button onClick={()=>{setAccForm({name:"",icon:"🏦",color:ACC_COLORS[accounts.length%ACC_COLORS.length],balance:"",type:"bank"});setEditAcc("new");}} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,width:70,padding:"10px 0",borderRadius:16,border:"1px dashed #2a2a2a",cursor:"pointer",background:"none"}}>
                  <span style={{fontSize:22}}>➕</span><div style={{color:"#555",fontSize:10,marginTop:4}}>Add</div>
                </button>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{display:"flex",gap:8,padding:"4px 16px 14px"}}>
              {[
                {icon:"➕",label:"Add",    action:()=>setScreen("add"),       color:"#4ECDC4"},
                {icon:"💸",label:"Transfer",action:()=>setScreen("transfer"),  color:"#F0A500"},
                {icon:"🔄",label:"Recur",  action:()=>setScreen("recurring"),  color:"#5DADE2"},
                {icon:"🎯",label:"Budgets",action:()=>setScreen("budgets"),    color:"#BB8FCE"},
                {icon:"📊",label:"Stats",  action:()=>setScreen("stats"),      color:"#45B7D1"},
              ].map(q=>(
                <button key={q.label} onClick={q.action} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 2px",borderRadius:16,cursor:"pointer",border:`1px solid ${q.color}44`,background:q.color+"18"}}>
                  <span style={{fontSize:20}}>{q.icon}</span>
                  <span style={{fontSize:9,color:q.color,fontWeight:700,marginTop:3}}>{q.label}</span>
                </button>
              ))}
            </div>

            {/* Recurring plans preview */}
            {recurPlans.filter(p=>p.active).length>0&&(
              <div style={{padding:"0 16px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={S.secTitle}>🔄 Recurring</span>
                  <button onClick={()=>setScreen("recurring")} style={{background:"none",border:"none",color:"#5DADE2",fontSize:12,cursor:"pointer"}}>Manage →</button>
                </div>
                {recurPlans.filter(p=>p.active).slice(0,3).map(plan=>{
                  const st=SIP_TYPES.find(s=>s.id===plan.sipType)||SIP_TYPES[7];
                  const nextDue=getNextDue(plan);
                  const isOverdue=nextDue<today();
                  return (
                    <div key={plan.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 13px",background:"#141414",borderRadius:14,marginBottom:8,border:`1px solid ${isOverdue?"#FF6B6B33":st.color+"33"}`}}>
                      <div style={{width:38,height:38,borderRadius:11,background:st.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{st.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{color:"#fff",fontWeight:700,fontSize:13}}>{plan.name}</div>
                        <div style={{color:"#666",fontSize:11,marginTop:1}}>Next: <span style={{color:isOverdue?"#FF6B6B":"#888"}}>{nextDue}</span> · {plan.frequency}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{color:plan.type==="income"?"#58D68D":"#FF6B6B",fontWeight:800,fontSize:14}}>{plan.type==="income"?"+":"-"}₹{fmtS(plan.amount)}</div>
                        <div style={{color:"#666",fontSize:10,marginTop:1}}>{getRunCount(plan.id)}x run</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Budget bars */}
            {budgets.length>0&&(
              <div style={{padding:"0 16px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={S.secTitle}>Budgets</span><button onClick={()=>setScreen("budgets")} style={{background:"none",border:"none",color:"#4ECDC4",fontSize:12,cursor:"pointer"}}>Manage →</button></div>
                {budgets.slice(0,3).map(b=>{ const spent=monthTxns.filter(t=>t.category===b.category&&t.type==="expense").reduce((s,t)=>s+t.amount,0); const pct=Math.min(spent/b.limit*100,100); const cat=getCat(b.category); const over=spent>b.limit; return (
                  <div key={b.id} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{color:"#fff",fontSize:13}}>{cat.icon} {cat.label}</span>
                      <span style={{color:over?"#FF6B6B":"#888",fontSize:12,fontWeight:600}}>{fmt(spent)} / {fmt(b.limit)}</span>
                    </div>
                    <div style={{height:8,background:"#2a2a2a",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:over?"#FF6B6B":pct>80?"#F7DC6F":cat.color,borderRadius:99,transition:"width 0.5s"}}/></div>
                  </div>
                );})}
              </div>
            )}

            {/* Recent */}
            <div style={{padding:"0 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={S.secTitle}>Recent</span>
                <button onClick={()=>setScreen("history")} style={{background:"none",border:"none",color:"#4ECDC4",fontSize:12,cursor:"pointer"}}>See all →</button>
              </div>
              {transactions.length===0&&<div style={S.empty}>No transactions yet. Tap ➕ to add one!</div>}
              {transactions.slice(0,5).map(t=><TxCard key={t.id} t={t} getCat={getCat} getAcc={getAcc} onDelete={delTx} onEdit={startEditTx}/>)}
            </div>
            <div style={{height:30}}/>
          </Scroll>
        )}

        {/* ADD / EDIT TRANSACTION */}
        {screen==="add"&&(
          <Scroll>
            <div style={S.card}>
              <div style={{display:"flex",gap:10,marginBottom:16}}>
                {["expense","income"].map(tp=><button key={tp} onClick={()=>setForm(f=>({...f,type:tp}))} style={{flex:1,padding:"11px",borderRadius:14,cursor:"pointer",fontWeight:700,fontSize:14,background:form.type===tp?(tp==="expense"?"#FF6B6B":"#58D68D"):"transparent",color:form.type===tp?"#fff":"#666",border:`2px solid ${tp==="expense"?"#FF6B6B":"#58D68D"}`}}>{tp==="expense"?"↓ Expense":"↑ Income"}</button>)}
              </div>
              <AmtInput value={form.amount} onChange={v=>setForm(f=>({...f,amount:v}))} sym="₹" large/>
              <FL>Account</FL>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {accounts.map(acc=><button key={acc.id} onClick={()=>setForm(f=>({...f,accountId:acc.id}))} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:12,cursor:"pointer",background:form.accountId===acc.id?acc.color+"30":"#1a1a1a",border:`2px solid ${form.accountId===acc.id?acc.color:"#2a2a2a"}`,color:form.accountId===acc.id?acc.color:"#888",fontWeight:600,fontSize:13}}><span>{acc.icon}</span>{acc.name}</button>)}
              </div>
              <FL>Category</FL>
              <div style={S.catGrid}>
                {CATEGORIES.map(c=><button key={c.id} onClick={()=>setForm(f=>({...f,category:c.id}))} style={{...S.catBtn,background:form.category===c.id?c.color:c.color+"18",border:`2px solid ${form.category===c.id?c.color:"transparent"}`,color:form.category===c.id?"#fff":c.color}}><span style={{fontSize:18}}>{c.icon}</span><span style={{fontSize:9,marginTop:2}}>{c.label.split(" ")[0]}</span></button>)}
              </div>
              <FL>Note</FL><input placeholder="What was this for?" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} style={S.inp}/>
              <FL>Tags (comma separated)</FL><input placeholder="e.g. work, personal" value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} style={S.inp}/>
              <FL>Date</FL><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={S.inp}/>
              <FL>Recurring</FL>
              <select value={form.recurring||"none"} onChange={e=>setForm(f=>({...f,recurring:e.target.value}))} style={{...S.inp,marginBottom:16}}>
                {RECUR_OPTS.map(o=><option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
              </select>
              <Btn onClick={saveTx}>{editTx?"Update Transaction":"Add Transaction"}</Btn>
            </div>
          </Scroll>
        )}

        {/* TRANSFER */}
        {screen==="transfer"&&(
          <Scroll>
            <div style={S.card}>
              <div style={{background:"#1a1a0a",borderRadius:14,padding:"12px 14px",marginBottom:16,border:"1px solid #3a3a1a",color:"#F7DC6F",fontSize:13}}>💸 Move money between your accounts instantly.</div>
              <FL>From Account</FL>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {accounts.map(acc=><button key={acc.id} onClick={()=>setXferForm(f=>({...f,from:acc.id}))} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:12,cursor:"pointer",background:xferForm.from===acc.id?acc.color+"30":"#1a1a1a",border:`2px solid ${xferForm.from===acc.id?acc.color:"#2a2a2a"}`,color:xferForm.from===acc.id?acc.color:"#888",fontWeight:600,fontSize:13}}><span>{acc.icon}</span>{acc.name}<span style={{color:"#666",fontSize:11}}>({fmt(acc.balance)})</span></button>)}
              </div>
              <FL>To Account</FL>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {accounts.filter(a=>a.id!==xferForm.from).map(acc=><button key={acc.id} onClick={()=>setXferForm(f=>({...f,to:acc.id}))} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:12,cursor:"pointer",background:xferForm.to===acc.id?acc.color+"30":"#1a1a1a",border:`2px solid ${xferForm.to===acc.id?acc.color:"#2a2a2a"}`,color:xferForm.to===acc.id?acc.color:"#888",fontWeight:600,fontSize:13}}><span>{acc.icon}</span>{acc.name}</button>)}
              </div>
              <FL>Amount (₹)</FL><AmtInput value={xferForm.amount} onChange={v=>setXferForm(f=>({...f,amount:v}))} sym="₹" large/>
              <Btn onClick={doTransfer}>Transfer Now 💸</Btn>
            </div>
          </Scroll>
        )}

        {/* WALLETS */}
        {screen==="wallets"&&(
          <Scroll>
            <div style={{padding:"16px 16px 0"}}>
              <div style={{background:"#141414",borderRadius:20,padding:18,marginBottom:14,border:"1px solid #222",textAlign:"center"}}>
                <div style={{color:"#888",fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>Total Across All Accounts</div>
                <div style={{color:"#fff",fontSize:32,fontWeight:900,marginTop:4}}>{fmt(totalWallet)}</div>
              </div>
              {accounts.map(acc=>{ const at=transactions.filter(t=>t.accountId===acc.id&&t.date?.startsWith(filterMonth)); const ae=at.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0); const ai=at.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0); return (
                <div key={acc.id} style={{background:"#141414",borderRadius:20,padding:18,marginBottom:14,border:`1px solid ${acc.color}44`}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                    <div style={{width:48,height:48,borderRadius:14,background:acc.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{acc.icon}</div>
                    <div style={{flex:1}}><div style={{color:"#fff",fontWeight:700,fontSize:16}}>{acc.name}</div><Tag color={acc.color}>{acc.type==="cash"?"CASH":"BANK"}</Tag></div>
                    <button onClick={()=>{setAccForm({name:acc.name,icon:acc.icon,color:acc.color,balance:acc.balance.toString(),type:acc.type});setEditAcc(acc);}} style={{background:"#2a2a2a",border:"none",borderRadius:10,padding:"6px 12px",color:"#aaa",cursor:"pointer",fontSize:12}}>Edit</button>
                  </div>
                  <div style={{color:acc.color,fontWeight:900,fontSize:26,marginBottom:12}}>{fmt(acc.balance)}</div>
                  <div style={{display:"flex",gap:10}}>
                    <div style={{flex:1,background:"#58D68D18",borderRadius:12,padding:"10px",textAlign:"center"}}><div style={{color:"#58D68D",fontSize:12,fontWeight:700}}>↑ {fmt(ai)}</div><div style={{color:"#666",fontSize:10,marginTop:2}}>Income</div></div>
                    <div style={{flex:1,background:"#FF6B6B18",borderRadius:12,padding:"10px",textAlign:"center"}}><div style={{color:"#FF6B6B",fontSize:12,fontWeight:700}}>↓ {fmt(ae)}</div><div style={{color:"#666",fontSize:10,marginTop:2}}>Spent</div></div>
                  </div>
                </div>
              );})}
              <Btn onClick={()=>{setAccForm({name:"",icon:"🏦",color:ACC_COLORS[accounts.length%ACC_COLORS.length],balance:"",type:"bank"});setEditAcc("new");}}>➕ Add New Account</Btn>
              <div style={{height:20}}/>
            </div>
          </Scroll>
        )}

        {/* BUDGETS */}
        {screen==="budgets"&&(
          <Scroll>
            <div style={{padding:"16px 16px 0"}}>
              <div style={{background:"#141414",borderRadius:16,padding:"14px 16px",marginBottom:16,border:"1px solid #222",color:"#888",fontSize:13,lineHeight:1.6}}>
                🎯 Set monthly spending limits per category. You'll get alerts when you're close to or over budget.
              </div>
              {budgets.length===0&&<div style={S.empty}>No budgets set yet.</div>}
              {budgets.map(b=>{ const spent=monthTxns.filter(t=>t.category===b.category&&t.type==="expense").reduce((s,t)=>s+t.amount,0); const pct=Math.min(spent/b.limit*100,100); const cat=getCat(b.category); const over=spent>b.limit; return (
                <div key={b.id} style={{background:"#141414",borderRadius:18,padding:16,marginBottom:12,border:`1px solid ${over?"#FF6B6B44":cat.color+"33"}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{width:40,height:40,borderRadius:12,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{cat.icon}</div>
                    <div style={{flex:1}}><div style={{color:"#fff",fontWeight:700,fontSize:14}}>{cat.label}</div><div style={{color:over?"#FF6B6B":"#888",fontSize:12}}>{fmt(spent)} of {fmt(b.limit)} used</div></div>
                    <button onClick={()=>{setBudgetForm({category:b.category,limit:b.limit.toString()});setEditBudget(b);}} style={{background:"#2a2a2a",border:"none",borderRadius:8,padding:"5px 10px",color:"#aaa",cursor:"pointer",fontSize:12}}>Edit</button>
                  </div>
                  <div style={{height:10,background:"#222",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:over?"#FF6B6B":pct>80?"#F7DC6F":cat.color,borderRadius:99,transition:"width 0.5s"}}/></div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                    <span style={{color:"#666",fontSize:11}}>{pct.toFixed(0)}% used</span>
                    <span style={{color:over?"#FF6B6B":"#666",fontSize:11}}>{over?"Over by "+fmt(spent-b.limit):"₹"+fmtS(b.limit-spent)+" left"}</span>
                  </div>
                </div>
              );})}
              <Btn onClick={()=>{setBudgetForm({category:"food",limit:""});setEditBudget("new");}}>➕ Add Budget</Btn>
              <div style={{height:20}}/>
            </div>
          </Scroll>
        )}

        {/* IMPORT */}
        {screen==="import"&&(
          <Scroll>
            <div style={S.card}>
              <div style={{background:"#0f1f0f",border:"1px solid #1e3a1e",borderRadius:12,padding:"12px 14px",color:"#82E0AA",fontSize:13,marginBottom:14,lineHeight:1.6}}>📋 Paste text or upload .txt / .csv<br/><span style={{opacity:0.6,fontSize:12}}>Format: <code>Food 500</code> or <code>2024-01-15 Salary 25000</code></span></div>
              <FL>Assign to Account</FL>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
                {accounts.map(acc=><button key={acc.id} onClick={()=>setImportAcc(acc.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:12,cursor:"pointer",background:importAcc===acc.id?acc.color+"30":"#1a1a1a",border:`2px solid ${importAcc===acc.id?acc.color:"#2a2a2a"}`,color:importAcc===acc.id?acc.color:"#888",fontWeight:600,fontSize:13}}><span>{acc.icon}</span>{acc.name}</button>)}
              </div>
              <textarea placeholder={"Paste transactions here...\n\nExamples:\nFood 500\nTransport -200\n2024-01-10 Salary 25000"} value={importText} onChange={e=>handleImportText(e.target.value)} style={{width:"100%",minHeight:120,background:"#0d0d0d",border:"1px solid #252525",borderRadius:14,padding:14,color:"#ccc",fontSize:13,outline:"none",resize:"vertical",fontFamily:"monospace",marginBottom:10,boxSizing:"border-box"}}/>
              <div style={{display:"flex",alignItems:"center",gap:10,margin:"10px 0"}}><div style={{flex:1,height:1,background:"#1e1e1e"}}/><span style={{color:"#444",fontSize:12}}>or</span><div style={{flex:1,height:1,background:"#1e1e1e"}}/></div>
              <button onClick={()=>fileRef.current.click()} style={{width:"100%",background:"transparent",border:"2px solid #2a2a2a",borderRadius:16,padding:"13px",color:"#888",fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:4}}>📁 Upload .txt / .csv File</button>
              <input ref={fileRef} type="file" accept=".txt,.csv" style={{display:"none"}} onChange={handleFile}/>
              {importPrev.length>0&&(<>
                <div style={{...S.secTitle,marginTop:16}}>Preview ({importPrev.length})</div>
                <div style={{maxHeight:200,overflowY:"auto"}}>
                  {importPrev.map((t,i)=><div key={i} style={{display:"flex",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #1a1a1a"}}><span style={{fontSize:18}}>{getCat(t.category).icon}</span><div style={{flex:1,marginLeft:8}}><div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{t.note}</div><div style={{fontSize:11,color:"#666"}}>{t.date}</div></div><span style={{color:"#FF6B6B",fontWeight:700}}>-{fmt(t.amount)}</span></div>)}
                </div>
                <Btn onClick={confirmImport}>Import {importPrev.length} Transactions</Btn>
              </>)}
            </div>
          </Scroll>
        )}

        {/* HISTORY */}
        {screen==="history"&&(
          <Scroll>
            <div style={{padding:"0 16px 8px"}}>
              <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{...S.inp,marginBottom:8}}/>
              {/* Search */}
              <div style={{position:"relative",marginBottom:10}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#555",fontSize:16}}>🔍</span>
                <input placeholder="Search by note or tag..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{...S.inp,marginBottom:0,paddingLeft:36}}/>
              </div>
              {/* Filter row */}
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8}}>
                <button onClick={()=>setFilterCat("all")} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,background:filterCat==="all"?"#4ECDC422":"#1a1a1a",border:`1px solid ${filterCat==="all"?"#4ECDC4":"#2a2a2a"}`,color:filterCat==="all"?"#4ECDC4":"#888",fontSize:11,fontWeight:600,cursor:"pointer"}}>All</button>
                {CATEGORIES.map(c=><button key={c.id} onClick={()=>setFilterCat(filterCat===c.id?"all":c.id)} style={{flexShrink:0,padding:"5px 10px",borderRadius:20,background:filterCat===c.id?c.color+"22":"#1a1a1a",border:`1px solid ${filterCat===c.id?c.color:"#2a2a2a"}`,color:filterCat===c.id?c.color:"#888",fontSize:11,fontWeight:600,cursor:"pointer"}}>{c.icon}</button>)}
              </div>
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginTop:4}}>
                <button onClick={()=>setFilterAcc("all")} style={{flexShrink:0,padding:"4px 12px",borderRadius:20,background:filterAcc==="all"?"#45B7D122":"#1a1a1a",border:`1px solid ${filterAcc==="all"?"#45B7D1":"#2a2a2a"}`,color:filterAcc==="all"?"#45B7D1":"#888",fontSize:11,cursor:"pointer"}}>All accounts</button>
                {accounts.map(a=><button key={a.id} onClick={()=>setFilterAcc(filterAcc===a.id?"all":a.id)} style={{flexShrink:0,display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,background:filterAcc===a.id?a.color+"22":"#1a1a1a",border:`1px solid ${filterAcc===a.id?a.color:"#2a2a2a"}`,color:filterAcc===a.id?a.color:"#888",fontSize:11,cursor:"pointer"}}><span>{a.icon}</span>{a.name}</button>)}
              </div>
            </div>
            <div style={{padding:"0 16px 100px"}}>
              {filteredTxns.length===0&&<div style={S.empty}>No transactions match your filters.</div>}
              {filteredTxns.map(t=><TxCard key={t.id} t={t} getCat={getCat} getAcc={getAcc} onDelete={delTx} onEdit={startEditTx}/>)}
            </div>
          </Scroll>
        )}

        {/* STATS */}
        {screen==="stats"&&(
          <Scroll>
            <div style={{padding:"0 16px"}}>
              <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={S.inp}/>
              <div style={{display:"flex",gap:10,marginBottom:16}}>
                {[{label:"Income",val:totalIncome,color:"#58D68D",icon:"↑"},{label:"Expense",val:totalExpense,color:"#FF6B6B",icon:"↓"},{label:"Saved",val:totalIncome-totalExpense,color:"#4ECDC4",icon:"💾"}].map(s=>(
                  <div key={s.label} style={{flex:1,background:s.color+"15",borderRadius:16,padding:"12px 8px",border:`1px solid ${s.color}33`,textAlign:"center"}}>
                    <div style={{color:s.color,fontSize:18,fontWeight:800}}>{s.icon}</div>
                    <div style={{color:s.color,fontSize:11,fontWeight:700,marginTop:4}}>{fmt(s.val)}</div>
                    <div style={{color:"#888",fontSize:10,marginTop:2}}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* 6-month trend */}
              <div style={S.secTitle}>6-Month Trend</div>
              <div style={{background:"#141414",borderRadius:18,padding:"16px 14px",marginBottom:16,border:"1px solid #1e1e1e"}}>
                <div style={{display:"flex",gap:4,alignItems:"flex-end",height:80}}>
                  {trendData.map(d=>(
                    <div key={d.ym} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <div style={{width:"100%",display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                        <div style={{width:"60%",height:`${(d.inc/maxTrend)*60}px`,background:"#58D68D44",borderRadius:"4px 4px 0 0",minHeight:2}}/>
                        <div style={{width:"60%",height:`${(d.exp/maxTrend)*60}px`,background:"#FF6B6B88",borderRadius:"4px 4px 0 0",minHeight:2}}/>
                      </div>
                      <div style={{color:d.ym===filterMonth?"#4ECDC4":"#555",fontSize:8,fontWeight:d.ym===filterMonth?700:400}}>{d.label.slice(0,3)}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:16,marginTop:8,justifyContent:"center"}}>
                  <span style={{color:"#58D68D",fontSize:11}}>▪ Income</span>
                  <span style={{color:"#FF6B6B",fontSize:11}}>▪ Expense</span>
                </div>
              </div>

              {/* By account */}
              <div style={S.secTitle}>By Account</div>
              {accounts.map(acc=>{ const exp=monthTxns.filter(t=>t.accountId===acc.id&&t.type==="expense").reduce((s,t)=>s+t.amount,0); const inc=monthTxns.filter(t=>t.accountId===acc.id&&t.type==="income").reduce((s,t)=>s+t.amount,0); if(exp+inc===0) return null; return <div key={acc.id} style={{background:"#141414",borderRadius:14,padding:"12px 14px",marginBottom:10,border:`1px solid ${acc.color}33`}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:18}}>{acc.icon}</span><span style={{color:"#fff",fontWeight:700,fontSize:14}}>{acc.name}</span><span style={{marginLeft:"auto",color:acc.color,fontWeight:700}}>{fmt(acc.balance)}</span></div><div style={{display:"flex",gap:8}}><span style={{color:"#58D68D",fontSize:12}}>↑ {fmt(inc)}</span><span style={{color:"#666"}}>·</span><span style={{color:"#FF6B6B",fontSize:12}}>↓ {fmt(exp)}</span></div></div>;})}

              {/* By category */}
              <div style={{...S.secTitle,marginTop:8}}>By Category</div>
              {catSpend.length===0&&<div style={S.empty}>No expenses this month.</div>}
              {catSpend.map(c=>(
                <div key={c.id} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{color:"#fff",fontSize:13}}>{c.icon} {c.label}</span><span style={{color:c.color,fontWeight:700,fontSize:13}}>{fmt(c.total)}</span></div>
                  <div style={{height:8,background:"#2a2a2a",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${(c.total/maxCat)*100}%`,background:c.color,borderRadius:99}}/></div>
                </div>
              ))}
            </div>
            <div style={{height:80}}/>
          </Scroll>
        )}

        {/* RECURRING / SIP SCREEN */}
        {screen==="recurring"&&(
          <Scroll>
            <div style={{padding:"12px 16px 0"}}>
              {/* Summary bar */}
              {recurPlans.length>0&&(()=>{
                const active=recurPlans.filter(p=>p.active);
                const monthlyOut=active.filter(p=>p.type==="expense"&&p.frequency==="monthly").reduce((s,p)=>s+p.amount,0);
                const monthlyIn=active.filter(p=>p.type==="income"&&p.frequency==="monthly").reduce((s,p)=>s+p.amount,0);
                return (
                  <div style={{background:"linear-gradient(135deg,#0d1f2d,#091520)",borderRadius:20,padding:18,marginBottom:16,border:"1px solid #1a3a55"}}>
                    <div style={{color:"#5DADE2",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:8}}>MONTHLY RECURRING SUMMARY</div>
                    <div style={{display:"flex",gap:0}}>
                      <div style={{flex:1,textAlign:"center"}}>
                        <div style={{color:"#58D68D",fontWeight:900,fontSize:18}}>+₹{fmtS(monthlyIn)}</div>
                        <div style={{color:"#666",fontSize:10,marginTop:2}}>Credits</div>
                      </div>
                      <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
                      <div style={{flex:1,textAlign:"center"}}>
                        <div style={{color:"#FF6B6B",fontWeight:900,fontSize:18}}>-₹{fmtS(monthlyOut)}</div>
                        <div style={{color:"#666",fontSize:10,marginTop:2}}>Debits</div>
                      </div>
                      <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
                      <div style={{flex:1,textAlign:"center"}}>
                        <div style={{color:active.length>0?"#5DADE2":"#666",fontWeight:900,fontSize:18}}>{active.length}</div>
                        <div style={{color:"#666",fontSize:10,marginTop:2}}>Active</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={S.secTitle}>All Plans</span>
                <button onClick={()=>{setRecurForm({name:"",sipType:"sip",amount:"",type:"expense",accountId:accounts[0]?.id||"",frequency:"monthly",startDate:today(),endDate:"",active:true,note:""});setEditRecur("new");}}
                  style={{background:"#5DADE222",border:"1px solid #5DADE244",borderRadius:12,padding:"6px 14px",color:"#5DADE2",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ New Plan</button>
              </div>

              {recurPlans.length===0&&(
                <div style={{textAlign:"center",padding:"50px 20px"}}>
                  <div style={{fontSize:56,marginBottom:12}}>🔄</div>
                  <div style={{color:"#fff",fontWeight:800,fontSize:18,marginBottom:8}}>No Recurring Plans</div>
                  <div style={{color:"#555",fontSize:13,lineHeight:1.6,marginBottom:24}}>Set up SIPs, EMIs, rent, subscriptions — any fixed recurring payment or income.</div>
                  <button onClick={()=>{setRecurForm({name:"",sipType:"sip",amount:"",type:"expense",accountId:accounts[0]?.id||"",frequency:"monthly",startDate:today(),endDate:"",active:true,note:""});setEditRecur("new");}}
                    style={{...S.primaryBtn,width:"auto",padding:"13px 28px",background:"linear-gradient(135deg,#5DADE2,#2e86c1)"}}>➕ Create First Plan</button>
                </div>
              )}

              {/* Group by type */}
              {SIP_TYPES.map(st=>{
                const plans=recurPlans.filter(p=>p.sipType===st.id);
                if(!plans.length) return null;
                return (
                  <div key={st.id} style={{marginBottom:20}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <span style={{fontSize:18}}>{st.icon}</span>
                      <span style={{color:st.color,fontWeight:700,fontSize:13}}>{st.label}</span>
                      <span style={{color:"#555",fontSize:11}}>({plans.length})</span>
                    </div>
                    {plans.map(plan=>{
                      const acc=getAcc(plan.accountId);
                      const nextDue=getNextDue(plan);
                      const isOverdue=plan.active&&nextDue<=today();
                      const totalPaid=getTotalPaid(plan.id);
                      const runCount=getRunCount(plan.id);
                      const expired=plan.endDate&&plan.endDate<today();
                      return (
                        <div key={plan.id} style={{background:"#141414",borderRadius:18,marginBottom:10,border:`1px solid ${plan.active?st.color+"44":"#2a2a2a"}`,overflow:"hidden",opacity:expired?0.6:1}}>
                          {/* Main row */}
                          <div style={{padding:"14px 14px 10px"}}>
                            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                              <div style={{width:44,height:44,borderRadius:13,background:st.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{st.icon}</div>
                              <div style={{flex:1}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                  <span style={{color:"#fff",fontWeight:700,fontSize:15}}>{plan.name}</span>
                                  {expired&&<span style={{background:"#888",color:"#000",fontSize:9,borderRadius:6,padding:"1px 6px",fontWeight:700}}>ENDED</span>}
                                  {!expired&&<span style={{background:plan.active?"#58D68D22":"#FF6B6B22",color:plan.active?"#58D68D":"#FF6B6B",fontSize:9,borderRadius:6,padding:"1px 6px",fontWeight:700}}>{plan.active?"● ACTIVE":"⏸ PAUSED"}</span>}
                                </div>
                                {plan.note&&<div style={{color:"#666",fontSize:11,marginTop:2}}>{plan.note}</div>}
                                <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap"}}>
                                  <span style={{color:"#888",fontSize:11}}>{plan.frequency.charAt(0).toUpperCase()+plan.frequency.slice(1)}</span>
                                  <span style={{color:"#555"}}>·</span>
                                  <span style={{color:acc?.color||"#888",fontSize:11}}>{acc?.icon} {acc?.name}</span>
                                  {plan.endDate&&<><span style={{color:"#555"}}>·</span><span style={{color:"#888",fontSize:11}}>ends {plan.endDate}</span></>}
                                </div>
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}>
                                <div style={{color:plan.type==="income"?"#58D68D":"#FF6B6B",fontWeight:900,fontSize:18}}>{plan.type==="income"?"+":"-"}₹{fmtS(plan.amount)}</div>
                                <div style={{color:"#666",fontSize:10,marginTop:2}}>per {plan.frequency.replace("ly","")}</div>
                              </div>
                            </div>

                            {/* Stats row */}
                            <div style={{display:"flex",gap:8,marginTop:12}}>
                              <div style={{flex:1,background:"#0d0d0d",borderRadius:10,padding:"8px",textAlign:"center"}}>
                                <div style={{color:"#5DADE2",fontWeight:700,fontSize:12}}>₹{fmtS(totalPaid)}</div>
                                <div style={{color:"#555",fontSize:9,marginTop:1}}>Total {plan.type==="income"?"received":"paid"}</div>
                              </div>
                              <div style={{flex:1,background:"#0d0d0d",borderRadius:10,padding:"8px",textAlign:"center"}}>
                                <div style={{color:"#BB8FCE",fontWeight:700,fontSize:12}}>{runCount}x</div>
                                <div style={{color:"#555",fontSize:9,marginTop:1}}>Times run</div>
                              </div>
                              <div style={{flex:1,background:isOverdue?"#FF6B6B15":"#0d0d0d",borderRadius:10,padding:"8px",textAlign:"center",border:isOverdue?"1px solid #FF6B6B33":"none"}}>
                                <div style={{color:isOverdue?"#FF6B6B":"#F7DC6F",fontWeight:700,fontSize:11}}>{plan.active?(expired?"Ended":nextDue):"Paused"}</div>
                                <div style={{color:"#555",fontSize:9,marginTop:1}}>{isOverdue?"Overdue":"Next due"}</div>
                              </div>
                            </div>
                          </div>

                          {/* Action bar */}
                          <div style={{display:"flex",borderTop:"1px solid #1e1e1e"}}>
                            {!expired&&(
                              <button onClick={()=>toggleRecurPlan(plan.id)}
                                style={{flex:1,padding:"11px",background:"none",border:"none",cursor:"pointer",color:plan.active?"#F7DC6F":"#58D68D",fontWeight:700,fontSize:12,borderRight:"1px solid #1e1e1e"}}>
                                {plan.active?"⏸ Pause":"▶ Resume"}
                              </button>
                            )}
                            <button onClick={()=>{setRecurForm({name:plan.name,sipType:plan.sipType,amount:plan.amount.toString(),type:plan.type,accountId:plan.accountId,frequency:plan.frequency,startDate:plan.startDate,endDate:plan.endDate||"",active:plan.active,note:plan.note||""});setEditRecur(plan);}}
                              style={{flex:1,padding:"11px",background:"none",border:"none",cursor:"pointer",color:"#4ECDC4",fontWeight:700,fontSize:12,borderRight:"1px solid #1e1e1e"}}>
                              ✏️ Edit
                            </button>
                            <button onClick={()=>delRecurPlan(plan.id)}
                              style={{flex:1,padding:"11px",background:"none",border:"none",cursor:"pointer",color:"#FF6B6B",fontWeight:700,fontSize:12}}>
                              🗑 Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* History of auto-generated recurring transactions */}
              {transactions.filter(t=>t.recurPlanId).length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={S.secTitle}>Auto-Generated History</div>
                  <div style={{background:"#141414",borderRadius:16,border:"1px solid #1e1e1e",overflow:"hidden"}}>
                    {transactions.filter(t=>t.recurPlanId).slice(0,10).map((t,i,arr)=>{
                      const plan=recurPlans.find(p=>p.id===t.recurPlanId);
                      const st=SIP_TYPES.find(s=>s.id===plan?.sipType)||SIP_TYPES[7];
                      const acc=getAcc(t.accountId);
                      return (
                        <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:i<arr.length-1?"1px solid #1e1e1e":"none"}}>
                          <span style={{fontSize:18}}>{st.icon}</span>
                          <div style={{flex:1}}>
                            <div style={{color:"#fff",fontSize:13,fontWeight:600}}>{t.note}</div>
                            <div style={{color:"#555",fontSize:10,marginTop:1}}>{t.date} · {acc?.icon} {acc?.name}</div>
                          </div>
                          <span style={{color:t.type==="income"?"#58D68D":"#FF6B6B",fontWeight:700,fontSize:13}}>{t.type==="income"?"+":"-"}₹{fmtS(t.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{height:20}}/>
            </div>
          </Scroll>
        )}

        {/* Personal bottom nav */}
        <div style={S.nav}>
          {[
            {icon:"🏠", label:"Home",    s:"home"},
            {icon:"➕", label:"Add",     s:"add"},
            {icon:"🔄", label:"Recur",   s:"recurring"},
            {icon:"📋", label:"History", s:"history"},
            {icon:"📊", label:"Stats",   s:"stats"},
          ].map(n=>(
            <button key={n.s} onClick={()=>{setScreen(n.s);if(n.s==="add"){setEditTx(null);setForm(blankForm);}}}
              style={{...S.navBtn,color:screen===n.s?"#5DADE2":"#555"}}>
              <span style={{fontSize:19}}>{n.icon}</span>
              <span style={{fontSize:9,fontWeight:screen===n.s?700:400}}>{n.label}</span>
              {n.s==="recurring"&&recurPlans.filter(p=>p.active&&getNextDue(p)<=today()).length>0&&(
                <span style={{position:"absolute",top:6,width:7,height:7,borderRadius:"50%",background:"#FF6B6B"}}/>
              )}
            </button>
          ))}
        </div>
      </>)}

      {/* ═══ TRIPS TAB ══════════════════════════════════════════════════════ */}
      {tab==="trips"&&tripScr==="list"&&(<>
        <Hdr title="✈️ Trip Splitter" right={<button onClick={()=>{setTripForm({name:"",icon:"🏖️",color:"#4ECDC4",date:today(),members:[],currency:"INR ₹"});setMemberName("");setTripScr("addTrip");}} style={{background:"none",border:"none",color:"#FF8C69",fontSize:26,cursor:"pointer",lineHeight:1}}>+</button>}/>
        <div style={{overflowY:"auto",height:"calc(100vh - 106px)",paddingBottom:20}}>
          {trips.length===0&&(
            <div style={{textAlign:"center",padding:"60px 30px"}}>
              <div style={{fontSize:64,marginBottom:16}}>✈️</div>
              <div style={{color:"#fff",fontSize:20,fontWeight:800,marginBottom:8}}>Plan a Group Trip</div>
              <div style={{color:"#555",fontSize:14,lineHeight:1.6,marginBottom:28}}>Track shared expenses, split bills fairly, and settle up — all in one place.</div>
              <button onClick={()=>{setTripForm({name:"",icon:"🏖️",color:"#4ECDC4",date:today(),members:[],currency:"INR ₹"});setMemberName("");setTripScr("addTrip");}} style={{...S.primaryBtn,width:"auto",padding:"14px 32px",background:"linear-gradient(135deg,#FF8C69,#e0632a)"}}>🚀 Create First Trip</button>
            </div>
          )}
          <div style={{padding:"0 16px"}}>
            {trips.map(trip=>{ const total=trip.expenses.reduce((s,e)=>s+e.amount,0); const {settlements}=calcSettlements(trip.members,trip.expenses); const pending=settlements.filter(s=>!settledIds.includes(`${trip.id}_${s.from}_${s.to}_${s.amount}`)).length; const sym=getCurSym(trip); return (
              <button key={trip.id} onClick={()=>openTrip(trip)} style={{width:"100%",background:"#141414",borderRadius:20,padding:18,marginBottom:14,border:`1px solid ${trip.color}44`,cursor:"pointer",textAlign:"left",display:"block"}}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:56,height:56,borderRadius:18,background:trip.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>{trip.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{color:"#fff",fontWeight:800,fontSize:17}}>{trip.name}</div>
                    <div style={{color:"#666",fontSize:12,marginTop:3}}>{trip.date} · {trip.currency||"INR ₹"} · {trip.members.length} people</div>
                    <div style={{display:"flex",marginTop:6,gap:0}}>{trip.members.map((m,i)=><span key={m.id} style={{marginLeft:i===0?0:-4,fontSize:16}}>{m.avatar}</span>)}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{color:trip.color,fontWeight:900,fontSize:18}}>{sym}{fmtS(total)}</div>
                    {pending>0?<div style={{background:"#FF6B6B22",color:"#FF6B6B",fontSize:10,fontWeight:700,borderRadius:99,padding:"2px 8px",marginTop:4}}>{pending} pending</div>:trip.expenses.length>0?<div style={{background:"#58D68D22",color:"#58D68D",fontSize:10,fontWeight:700,borderRadius:99,padding:"2px 8px",marginTop:4}}>✓ settled</div>:null}
                  </div>
                </div>
              </button>
            );})}
          </div>
        </div>
      </>)}

      {toast&&<Toast t={toast}/>}
    </Wrapper>
  );
}

// ─── Reusable Components ──────────────────────────────────────────────────────
function Wrapper({children}){ return <div style={S.root}>{children}</div>; }
function Hdr({left,title,right}){ return <div style={S.hdr}>{left||<div style={{width:36}}/>}<span style={S.hdrTitle}>{title}</span>{right||<div style={{width:36}}/>}</div>; }
function BkBtn({onClick}){ return <button onClick={onClick} style={{background:"none",border:"none",color:"#4ECDC4",fontSize:30,cursor:"pointer",padding:"0 4px",lineHeight:1}}>‹</button>; }
function Scroll({children,h}){ return <div style={{overflowY:"auto",paddingBottom:90,height:h||"calc(100vh - 156px)"}}>{children}</div>; }
function FL({children}){ return <div style={{color:"#666",fontSize:11,fontWeight:700,marginBottom:8,letterSpacing:0.8,textTransform:"uppercase"}}>{children}</div>; }
function Tag({color,children}){ return <div style={{background:color+"22",color,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px",display:"inline-block",marginTop:2}}>{children}</div>; }
function Btn({onClick,children,style={}}){ return <button onClick={onClick} style={{...S.primaryBtn,...style}}>{children}</button>; }
function Toast({t}){ return <div style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",borderRadius:30,padding:"11px 22px",color:"#fff",fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",background:t.type==="error"?"#FF6B6B":"#58D68D"}}>{t.msg}</div>; }
function AmtInput({value,onChange,sym,large}){ return <div style={{display:"flex",alignItems:"center",background:"#0d0d0d",borderRadius:16,padding:"8px 16px",marginBottom:16,border:"1px solid #252525"}}><span style={{color:"#4ECDC4",fontSize:large?24:18,fontWeight:800,marginRight:6}}>{sym}</span><input type="number" placeholder="0" value={value} onChange={e=>onChange(e.target.value)} style={{flex:1,background:"none",border:"none",color:"#fff",fontSize:large?30:18,fontWeight:900,outline:"none",width:"100%"}}/></div>; }
function IconGrid({icons,selected,onSelect,color}){ return <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>{icons.map(ic=><button key={ic} onClick={()=>onSelect(ic)} style={{width:40,height:40,borderRadius:12,fontSize:20,background:selected===ic?color+"33":"#1e1e1e",border:`2px solid ${selected===ic?color:"#333"}`,cursor:"pointer"}}>{ic}</button>)}</div>; }
function ColorGrid({colors,selected,onSelect}){ return <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>{colors.map(c=><button key={c} onClick={()=>onSelect(c)} style={{width:32,height:32,borderRadius:"50%",background:c,border:`3px solid ${selected===c?"#fff":"transparent"}`,cursor:"pointer"}}/>)}</div>; }

function TxCard({t,getCat,getAcc,onDelete,onEdit}){
  const cat=getCat(t.category), acc=getAcc(t.accountId);
  const [open,setOpen]=useState(false);
  return (
    <div style={{background:"#141414",borderRadius:16,marginBottom:9,border:"1px solid #1e1e1e",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"13px",cursor:"pointer"}} onClick={()=>setOpen(v=>!v)}>
        <div style={{width:44,height:44,borderRadius:13,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{cat.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{color:"#fff",fontSize:14,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.note||cat.label}</div>
            {t.recurring&&t.recurring!=="none"&&<span style={{background:"#BB8FCE22",color:"#BB8FCE",fontSize:9,borderRadius:6,padding:"1px 5px",flexShrink:0}}>🔄 {t.recurring}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}>
            <span style={{fontSize:10,color:acc?.color||"#888",background:(acc?.color||"#888")+"20",borderRadius:6,padding:"1px 6px",fontWeight:600}}>{acc?.icon} {acc?.name}</span>
            <span style={{color:"#555",fontSize:10}}>{t.date}</span>
          </div>
          {(t.tags||[]).length>0&&<div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>{(t.tags||[]).map(tg=><span key={tg} style={{background:"#2a2a2a",color:"#888",fontSize:9,borderRadius:6,padding:"1px 6px"}}>#{tg}</span>)}</div>}
        </div>
        <span style={{color:t.type==="income"?"#58D68D":"#FF6B6B",fontWeight:800,fontSize:15,flexShrink:0}}>{t.type==="income"?"+":"-"}{fmtS(t.amount)}</span>
      </div>
      {open&&(
        <div style={{display:"flex",gap:8,padding:"0 13px 12px"}}>
          <button onClick={()=>onEdit(t)} style={{flex:1,background:"#4ECDC422",border:"1px solid #4ECDC444",color:"#4ECDC4",borderRadius:10,padding:"8px",cursor:"pointer",fontSize:13,fontWeight:600}}>✏️ Edit</button>
          <button onClick={()=>onDelete(t.id)} style={{flex:1,background:"#FF6B6B18",border:"1px solid #FF6B6B33",color:"#FF6B6B",borderRadius:10,padding:"8px",cursor:"pointer",fontSize:13,fontWeight:600}}>🗑 Delete</button>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S={
  root:      {background:"#0a0a0a",minHeight:"100vh",maxWidth:430,margin:"0 auto",fontFamily:"'Sora','Nunito',sans-serif",position:"relative",overflowX:"hidden"},
  tabBar:    {display:"flex",background:"#0e0e0e",borderBottom:"1px solid #1a1a1a"},
  tabBtn:    {flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"11px 0",background:"none",border:"none",borderBottom:"3px solid transparent",cursor:"pointer",transition:"all 0.2s"},
  hdr:       {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px 8px",borderBottom:"1px solid #1a1a1a"},
  hdrTitle:  {color:"#fff",fontWeight:800,fontSize:16,letterSpacing:-0.3},
  hero:      {margin:16,borderRadius:22,padding:"20px",background:"linear-gradient(140deg,#0d1f2d,#091520)",border:"1px solid #1a3a55"},
  heroLabel: {color:"#4ECDC4",fontSize:10,fontWeight:700,letterSpacing:1.5,marginBottom:6},
  heroAmt:   {color:"#fff",fontSize:32,fontWeight:900,letterSpacing:-1},
  heroRow:   {display:"flex",gap:0,marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.08)"},
  heroStat:  {flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3},
  card:      {margin:16,background:"#141414",borderRadius:22,padding:18,border:"1px solid #1e1e1e"},
  previewCard:{display:"flex",alignItems:"center",padding:"14px",borderRadius:16,border:"1px solid"},
  catGrid:   {display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16},
  catBtn:    {display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 4px",borderRadius:14,cursor:"pointer"},
  inp:       {width:"100%",background:"#0d0d0d",border:"1px solid #252525",borderRadius:12,padding:"12px 14px",color:"#fff",fontSize:14,outline:"none",marginBottom:14,boxSizing:"border-box"},
  primaryBtn:{width:"100%",background:"linear-gradient(135deg,#4ECDC4,#3aa8a0)",border:"none",borderRadius:16,padding:"15px",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer"},
  secTitle:  {color:"#fff",fontWeight:700,fontSize:15,marginBottom:10},
  empty:     {color:"#444",textAlign:"center",padding:"40px 20px",fontSize:14},
  nav:       {position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"#0e0e0e",borderTop:"1px solid #1a1a1a",display:"flex",padding:"8px 0 18px"},
  navBtn:    {flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",position:"relative"},
};
