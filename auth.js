/* auth.css — landing/login page (FORCED LIGHT MODE) */
:root{
  --bg:#f6f7fb;
  --card:#ffffff;
  --text:#111827;
  --muted:#6b7280;
  --border:#e5e7eb;
  --primary:#111827;
  --primaryText:#ffffff;
  --focus:#2563eb;
  --shadow: 0 18px 50px rgba(17,24,39,.12);
}

*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
  background:var(--bg);
  color:var(--text);
}

.page{
  min-height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px;
}

.card{
  width:min(520px, 100%);
  background:var(--card);
  border:1px solid var(--border);
  border-radius:16px;
  padding:22px;
  box-shadow:var(--shadow);
}

.brand{
  display:flex;
  gap:14px;
  align-items:center;
  margin-bottom:14px;
}
.logo{
  width:44px;height:44px;
  border-radius:12px;
  background:var(--text);
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:700;
  letter-spacing:.5px;
}
.brand h1{margin:0;font-size:20px}
.brand p{margin:4px 0 0}

.muted{color:var(--muted)}
.small{font-size:12px}

.tabs{
  display:flex;
  gap:8px;
  margin:14px 0 10px;
}
.tab{
  flex:1;
  padding:10px 12px;
  background:#fff;
  border:1px solid var(--border);
  border-radius:12px;
  cursor:pointer;
  font-weight:600;
}
.tab.active{
  border-color:rgba(17,24,39,.35);
  background:#f3f4f6;
}

.panel{margin-top:8px}
.hidden{display:none}

label{
  display:block;
  margin:12px 0 6px;
  font-weight:600;
  font-size:13px;
}

input{
  width:100%;
  padding:11px 12px;
  border:1px solid var(--border);
  border-radius:12px;
  font-size:14px;
  outline:none;
}
input:focus{
  border-color:rgba(37,99,235,.45);
  box-shadow:0 0 0 4px rgba(37,99,235,.12);
}

.primary{
  width:100%;
  margin-top:14px;
  padding:11px 12px;
  border:none;
  border-radius:12px;
  background:var(--primary);
  color:var(--primaryText);
  font-weight:700;
  cursor:pointer;
}
.primary:focus{
  outline: 3px solid rgba(37,99,235,.25);
  outline-offset:2px;
}

.msg{
  margin-top:12px;
  padding:10px 12px;
  border-radius:12px;
  border:1px solid transparent;
  min-height: 18px;
}
.msg.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
.msg.err{background:#fef2f2;border-color:#fecaca;color:#991b1b}

.footer{
  margin-top:14px;
  display:flex;
  justify-content:space-between;
}

.top-actions{
  display:flex;
  justify-content:space-between;
  margin:12px 0;
}
.link-btn{
  flex:1;
  padding:10px 12px;
  background:#ffffff;
  border:1px solid var(--border);
  border-radius:12px;
  cursor:pointer;
  font-weight:700;
  color:var(--text);
}
.link-btn:hover{
  background:#f3f4f6;
}

.top-actions{
  display:flex;
  gap:8px;
  margin:12px 0 16px;
}
