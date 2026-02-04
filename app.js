// app.js (module)
import { supabase, isSupabaseConfigured } from "./supabase-config.js";

/* =========================
   DOM
========================= */
const $ = (id) => document.getElementById(id);

const searchInput = $("searchInput");
const searchBtn = $("searchBtn");
const clearSearchBtn = $("clearSearchBtn");

const exportCSVBtn = $("exportCSV");
const addTaskBtn = $("globalAddTask");
const logoutBtn = $("logoutBtn");

const themeSwitch = $("themeSwitch");

const modal = $("taskModal");
const saveBtn = $("saveBtn");
const cancelBtn = $("cancelBtn");

const taskTitle = $("taskTitle");
const taskDesc = $("taskDesc");
const taskUpdate = $("taskUpdate");
const taskDept = $("taskDept");
const taskOwner = $("taskOwner");
const taskReceived = $("taskReceived");
const taskDeadline = $("taskDeadline");
const taskUrgency = $("taskUrgency");

const archiveList = $("archiveList");

/* =========================
   AUTH
========================= */
async function requireAuth() {
  if (!isSupabaseConfigured()) {
    alert("Supabase is not configured yet. Please paste your URL + anon key in supabase-config.js.");
    window.location.href = "./index.html";
    return false;
  }
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    window.location.href = "./index.html";
    return false;
  }
  return true;
}

async function doLogout() {
  await supabase.auth.signOut();
  window.location.href = "./index.html";
}

async function checkAdmin() {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return false;

    const { data, error } = await supabase
      .from(SB_TABLE_ADMINS)
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}


/* =========================
   THEME (persisted)
========================= */
function applyTheme(mode) {
  if (mode === "dark") {
    document.body.classList.add("dark");
    themeSwitch.checked = true;
  } else {
    document.body.classList.remove("dark");
    themeSwitch.checked = false;
  }
  localStorage.setItem("pm_theme", mode);
}

(function initTheme() {
  const saved = localStorage.getItem("pm_theme");
  applyTheme(saved || "light");
})();

themeSwitch?.addEventListener("change", () => {
  applyTheme(themeSwitch.checked ? "dark" : "light");
});

/* =========================
   DATA
========================= */
let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
let archive = JSON.parse(localStorage.getItem("archive") || "[]");
let editId = null;

const SB_TABLE_TASKS = "tasks";
const SB_TABLE_ARCHIVE = "archive";
const SB_TABLE_ADMINS = "admins";

let isAdmin = false;

/* =========================
   SUPABASE LOAD/SAVE
========================= */
async function sbLoadAll() {
  if (!isSupabaseConfigured()) return false;

  const [{ data: tData, error: tErr }, { data: aData, error: aErr }] = await Promise.all([
    supabase.from(SB_TABLE_TASKS).select("*").order("id", { ascending: true }),
    supabase.from(SB_TABLE_ARCHIVE).select("*").order("id", { ascending: true }),
  ]);

  if (tErr || aErr) {
    console.warn("Supabase load failed; falling back to localStorage.", tErr || aErr);
    return false;
  }

  tasks = (tData || []).map((r) => r.payload).filter(Boolean);
  archive = (aData || []).map((r) => r.payload).filter(Boolean);

  localStorage.setItem("tasks", JSON.stringify(tasks));
  localStorage.setItem("archive", JSON.stringify(archive));
  return true;
}

let sbSaveTimer = null;
function sbScheduleSave() {
  // Debounce to avoid spamming on drag/drop
  clearTimeout(sbSaveTimer);
  sbSaveTimer = setTimeout(() => sbUpsertAll(), 250);
}

async function sbUpsertAll() {
  if (!isSupabaseConfigured()) return;

  const tRows = (tasks || []).map((t) => ({ id: t.id, payload: t }));
  const aRows = (archive || []).map((a) => ({ id: a.id, payload: a }));

  const [tUp, aUp] = await Promise.all([
    supabase.from(SB_TABLE_TASKS).upsert(tRows, { onConflict: "id" }),
    supabase.from(SB_TABLE_ARCHIVE).upsert(aRows, { onConflict: "id" }),
  ]);

  if (tUp.error || aUp.error) {
    console.warn("Supabase upsert failed.", tUp.error || aUp.error);
    return;
  }
}

function persistAll() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  localStorage.setItem("archive", JSON.stringify(archive));
  sbScheduleSave();
}

/* =========================
   REALTIME (EVERYONE SEES UPDATES)
========================= */
function sbSubscribeRealtime() {
  if (!isSupabaseConfigured()) return;

  const ch = supabase.channel("pmtool-realtime");

  ch.on("postgres_changes", { event: "*", schema: "public", table: SB_TABLE_TASKS }, async () => {
    await sbLoadAll();
    renderTasks();
    renderArchive();
  });

  ch.on("postgres_changes", { event: "*", schema: "public", table: SB_TABLE_ARCHIVE }, async () => {
    await sbLoadAll();
    renderTasks();
    renderArchive();
  });

  ch.subscribe();
}

/* =========================
   MODAL
========================= */
function openModal(id = null) {
  editId = id;
  modal.style.display = "flex";

  if (id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;

    taskTitle.value = t.title || "";
    taskDesc.value = t.desc || "";
    taskUpdate.value = t.update || "";
    taskDept.value = t.department || "Admin";
    if (taskOwner) taskOwner.value = t.owner || "";
    taskReceived.value = t.received || "";
    taskDeadline.value = t.deadline || "";
    taskUrgency.value = t.urgency || "low";
  } else {
    taskTitle.value = "";
    taskDesc.value = "";
    taskUpdate.value = "";
    taskDept.value = "Admin";
    if (taskOwner) taskOwner.value = "";
    taskReceived.value = "";
    taskDeadline.value = "";
    taskUrgency.value = "low";
  }
}

function closeModal() {
  modal.style.display = "none";
  editId = null;
}

function saveTask() {
  if (!taskTitle.value.trim()) return alert("Title required");

  const payload = {
    title: taskTitle.value.trim(),
    desc: taskDesc.value || "",
    update: taskUpdate.value || "",
    department: taskDept.value || "Admin",
    owner: (taskOwner?.value || ""),
    received: taskReceived.value || "",
    deadline: taskDeadline.value || "",
    urgency: taskUrgency.value || "low",
  };

  if (editId) {
    Object.assign(tasks.find((t) => t.id === editId), payload);
  } else {
    tasks.push({ id: Date.now(), ...payload });
  }

  persistAll();
  closeModal();
  renderTasks();
}

/* =========================
   RENDERING
========================= */
const DEPT_KEYS = ["admin", "workforce", "compliance", "complaints", "acquisition", "teletrim"];
const KEY_TO_LABEL = {
  admin: "Admin",
  workforce: "Workforce",
  compliance: "Compliance",
  complaints: "Complaints",
  acquisition: "Acquisition",
  teletrim: "Teletrim",
};
const LABEL_TO_KEY = Object.fromEntries(Object.entries(KEY_TO_LABEL).map(([k, v]) => [v, k]));

function normalizeDeptKey(v) {
  const s = String(v || "").trim();
  const key = LABEL_TO_KEY[s] || s.toLowerCase();
  return DEPT_KEYS.includes(key) ? key : "admin";
}

function keyToLabel(key) {
  return KEY_TO_LABEL[normalizeDeptKey(key)] || "Admin";
}

function renderTasks(filtered = null) {
  document.querySelectorAll(".tasks-container").forEach((c) => (c.innerHTML = ""));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const list = filtered || tasks;

  // Column counts
  updateColumnCounts(list);

  list.forEach((t) => {
    // Back-compat
    if (!t.deadline && t.due) t.deadline = t.due;
    if (!t.received && t.start) t.received = t.start;
    if (!t.urgency && t.priority) t.urgency = t.priority;
    if (!t.department && t.assignedTo) t.department = t.assignedTo;

    const deptKey = normalizeDeptKey(t.department);
    const col = document.querySelector(`[data-dept="${deptKey}"] .tasks-container`);
    if (!col) return;

    const div = document.createElement("div");
    div.className = `task priority-${(t.urgency || "low")}`;
    div.draggable = true;
    div.dataset.id = t.id;

    if (t.deadline) {
      const dueDate = new Date(t.deadline);
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate.getTime() === today.getTime()) div.classList.add("due-today");
      else if (dueDate.getTime() === tomorrow.getTime()) div.classList.add("due-tomorrow");
    }

    const dueText = t.deadline ? formatDate(t.deadline) : "No deadline";
    const dueClass = t.deadline ? "task-due" : "task-due missing";

    div.innerHTML = `
      <div class="task-top">
        <div class="task-title">${escapeHTML(t.title)}</div>
        <div class="${dueClass}">${escapeHTML(dueText)}</div>
      </div>
      <div class="task-actions">
        <button class="archive-btn">Archive</button>
        ${isAdmin ? `<button class="delete-btn">Delete</button>` : ``}
      </div>
    `;

    div.querySelector(".archive-btn").onclick = (e) => {
      e.stopPropagation();
      archive.push({ ...t, archivedAt: new Date().toLocaleString() });
      tasks = tasks.filter((x) => x.id !== t.id);
      persistAll();
      renderTasks();
      renderArchive();
    };

    div.querySelector(".delete-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!isAdmin) return alert("Only admins can delete tasks.");
      if (confirm("Are you sure you want to delete this task?")) {
        tasks = tasks.filter((x) => x.id !== t.id);
        persistAll();
        renderTasks();
      }
    });

    div.onclick = () => openModal(t.id);

    col.appendChild(div);
  });

  enableDragAndDrop();
}

function updateColumnCounts(list) {
  document.querySelectorAll(".column").forEach((col) => {
    const deptKey = normalizeDeptKey(col.dataset.dept);
    const title = col.querySelector(".title");
    if (!title) return;

    const baseTitle = title.dataset.base || title.textContent.replace(/\(\d+\)$/g, "").trim();
    title.dataset.base = baseTitle;

    const count = list.filter((t) => normalizeDeptKey(t.department) === deptKey).length;
    title.textContent = `${baseTitle} (${count})`;
  });
}

function renderArchive() {
  archiveList.innerHTML = archive.length ? "" : "<p>No archived tasks</p>";

  archive.forEach((t) => {
    // Back-compat
    if (!t.deadline && t.due) t.deadline = t.due;

    const div = document.createElement("div");
    div.className = "task";

    const dueText = t.deadline ? formatDate(t.deadline) : "No deadline";
    const dueClass = t.deadline ? "task-due" : "task-due missing";

    div.innerHTML = `
      <div class="task-top">
        <div class="task-title">${escapeHTML(t.title)}</div>
        <div class="${dueClass}">${escapeHTML(dueText)}</div>
      </div>
      <div class="task-actions">
        <button class="archive-btn">Restore</button>
        ${isAdmin ? `<button class="delete-btn">Delete</button>` : ``}
      </div>
    `;

    div.querySelector(".archive-btn").onclick = (e) => {
      e.stopPropagation();
      // Restored task keeps its department
      tasks.push({ ...t });
      archive = archive.filter((x) => x.id !== t.id);
      persistAll();
      renderTasks();
      renderArchive();
    };

    div.querySelector(".delete-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!isAdmin) return alert("Only admins can delete tasks.");
      if (confirm("Are you sure you want to permanently delete this archived task?")) {
        archive = archive.filter((x) => x.id !== t.id);
        persistAll();
        renderArchive();
      }
    });

    archiveList.appendChild(div);
  });
}

/* =========================
   DRAG & DROP (department move)
========================= */
function enableDragAndDrop() {
  document.querySelectorAll(".tasks-container").forEach((col) => {
    col.ondragover = (e) => e.preventDefault();
    col.ondrop = (e) => {
      const id = +e.dataTransfer.getData("id");
      const t = tasks.find((x) => x.id === id);
      if (!t) return;

      const deptKey = normalizeDeptKey(col.parentElement.dataset.dept);
      t.department = keyToLabel(deptKey);

      persistAll();
      renderTasks();
    };
  });

  document.querySelectorAll(".tasks-container .task").forEach((div) => {
    div.ondragstart = (e) => e.dataTransfer.setData("id", div.dataset.id);
  });
}

/* =========================
   SEARCH
========================= */
function doSearch() {
  const q = (searchInput?.value || "").trim().toLowerCase();
  if (!q) return renderTasks();

  const filtered = tasks.filter((t) => {
    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.desc && t.desc.toLowerCase().includes(q)) ||
      (t.update && t.update.toLowerCase().includes(q)) ||
      (t.department && String(t.department).toLowerCase().includes(q)) ||
      (t.owner && String(t.owner).toLowerCase().includes(q)) ||
      (t.received && String(t.received).includes(q)) ||
      (t.deadline && String(t.deadline).includes(q)) ||
      (t.urgency && String(t.urgency).toLowerCase().includes(q))
    );
  });

  renderTasks(filtered);
}

/* =========================
   EXPORT CSV (by department)
   Columns: Title, Description, Update, Department, Received Date, Deadline, Urgency
========================= */
function exportToCSV() {
  if (!tasks.length) return alert("No tasks to export");

  const header = ["Title", "Description", "Update", "Department", "Owner", "Received Date", "Deadline", "Urgency"];
  const rows = [];

  DEPT_KEYS.forEach((deptKey) => {
    const deptLabel = KEY_TO_LABEL[deptKey];
    const group = tasks.filter((t) => normalizeDeptKey(t.department) === deptKey);
    if (!group.length) return;

    rows.push(`${deptLabel}`);
    rows.push(header.join(","));

    group.forEach((t) => {
      const row = [
        t.title || "",
        t.desc || "",
        t.update || "",
        t.department || deptLabel,
        t.owner || "",
        t.received || "",
        t.deadline || "",
        t.urgency || "low",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);

      rows.push(row.join(","));
    });

    rows.push("");
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `team_dashboard_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

/* =========================
   HELPERS
========================= */
function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(yyyy_mm_dd) {
  try {
    const d = new Date(yyyy_mm_dd + "T00:00:00");
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return yyyy_mm_dd;
  }
}

/* =========================
   EVENTS
========================= */
window.onload = async () => {
  const ok = await requireAuth();
  if (!ok) return;

  isAdmin = await checkAdmin();

  await sbLoadAll();
  sbSubscribeRealtime();
  renderTasks();
  renderArchive();
};

addTaskBtn?.addEventListener("click", () => openModal(null));
saveBtn?.addEventListener("click", saveTask);
cancelBtn?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

logoutBtn?.addEventListener("click", doLogout);

searchBtn?.addEventListener("click", doSearch);
clearSearchBtn?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  renderTasks();
});
searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

exportCSVBtn?.addEventListener("click", exportToCSV);
