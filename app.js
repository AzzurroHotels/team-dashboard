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
// NOTE: IDs must match app.html
const taskDesc = $("taskDesc");
const taskUpdate = $("taskUpdate");
const taskDept = $("taskDept");
// Optional field (not present in app.html by default)
const taskOwner = $("taskOwner");
const taskReceived = $("taskReceived");
const taskDeadline = $("taskDeadline");
const taskUrgency = $("taskUrgency");

const archiveList = $("archiveList");

/* =========================
   STATE
========================= */
const SB_TABLE_TASKS = "tasks";
const SB_TABLE_ARCHIVE = "archive";
const SB_TABLE_ADMINS = "admins";

let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
let archive = JSON.parse(localStorage.getItem("archive") || "[]");
let editId = null;
let isAdmin = false;

/* =========================
   HELPERS
========================= */
function escapeHTML(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function persistAll() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  localStorage.setItem("archive", JSON.stringify(archive));
}

function formatDate(v) {
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return String(v);
  }
}

/* =========================
   AUTH
========================= */
async function requireAuth() {
  if (!isSupabaseConfigured()) return true;

  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

async function doLogout() {
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem("tasks");
  localStorage.removeItem("archive");
  window.location.href = "index.html";
}

async function checkAdmin() {
  if (!isSupabaseConfigured()) return false;

  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return false;

  const { data: rows, error } = await supabase.from(SB_TABLE_ADMINS).select("user_id").eq("user_id", userId).maybeSingle();
  if (error) return false;
  return !!rows?.user_id;
}

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
  }
}

async function sbUpsertOne(table, payloadObj) {
  if (!isSupabaseConfigured()) return;
  await supabase.from(table).upsert({ id: payloadObj.id, payload: payloadObj }, { onConflict: "id" });
}

async function sbDeleteOne(table, id) {
  if (!isSupabaseConfigured()) return;
  await supabase.from(table).delete().eq("id", id);
}

/* =========================
   REALTIME
========================= */
function enableRealtime() {
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
  const payload = {
    title: taskTitle.value || "",
    desc: taskDesc.value || "",
    update: taskUpdate.value || "",
    department: taskDept.value || "Admin",
    owner: taskOwner ? (taskOwner.value || "") : "",
    received: taskReceived.value || "",
    deadline: taskDeadline.value || "",
    urgency: taskUrgency.value || "low",
    // ✅ IMPORTANT: preserve status when editing so Done tasks don't disappear
    status: editId ? (tasks.find((t) => t.id === editId)?.status || "") : "",
  };

  if (editId) {
    Object.assign(tasks.find((t) => t.id === editId), payload);
  } else {
    tasks.push({ id: Date.now(), ...payload });
  }

  persistAll();
  sbScheduleSave();
  closeModal();
  renderTasks();
}

/* =========================
   RENDERING
========================= */
const DEPT_KEYS = ["admin", "workforce", "compliance", "complaints", "acquisition", "teletrim"];
const DONE_KEY = "done";

function isDoneTask(t) {
  return String(t?.status || "").toLowerCase() === "done";
}

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

  updateColumnCounts(list);

  list.forEach((t) => {
    // Back-compat
    if (!t.deadline && t.due) t.deadline = t.due;
    if (!t.received && t.start) t.received = t.start;
    if (!t.urgency && t.priority) t.urgency = t.priority;
    if (!t.department && t.assignedTo) t.department = t.assignedTo;

    const deptKey = normalizeDeptKey(t.department);

    // ✅ FIX: Done tasks render into Done column, but keep department untouched
    const targetKey = isDoneTask(t) ? DONE_KEY : deptKey;

    const col = document.querySelector(`[data-dept="${targetKey}"] .tasks-container`);
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

    div.querySelector(".archive-btn").onclick = async (e) => {
      e.stopPropagation();
      archive.push({ ...t, archivedAt: new Date().toLocaleString() });
      tasks = tasks.filter((x) => x.id !== t.id);

      await sbUpsertOne(SB_TABLE_ARCHIVE, archive[archive.length - 1]);
      await sbDeleteOne(SB_TABLE_TASKS, t.id);

      persistAll();
      renderTasks();
      renderArchive();
    };

    div.querySelector(".delete-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!isAdmin) return alert("Only admins can delete tasks.");
      if (confirm("Are you sure you want to delete this task?")) {
        tasks = tasks.filter((x) => x.id !== t.id);
        await sbDeleteOne(SB_TABLE_TASKS, t.id);
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
    const rawKey = String(col.dataset.dept || "").toLowerCase();
    const deptKey = rawKey === DONE_KEY ? DONE_KEY : normalizeDeptKey(rawKey);

    const title = col.querySelector(".title");
    if (!title) return;

    const baseTitle = title.dataset.base || title.textContent.replace(/\(\d+\)$/g, "").trim();
    title.dataset.base = baseTitle;

    // ✅ FIX: Done count uses status, department counts exclude done
    const count =
      deptKey === DONE_KEY
        ? list.filter((t) => isDoneTask(t)).length
        : list.filter((t) => !isDoneTask(t) && normalizeDeptKey(t.department) === deptKey).length;

    title.textContent = `${baseTitle} (${count})`;
  });
}

function renderArchive() {
  archiveList.innerHTML = archive.length ? "" : "<p>No archived tasks</p>";

  archive.forEach((t) => {
    if (!t.deadline && t.due) t.deadline = t.due;

    const div = document.createElement("div");
    div.className = "archive-item";
    div.innerHTML = `
      <div class="archive-title">${escapeHTML(t.title)}</div>
      <div class="archive-meta">
        <span>${escapeHTML(t.department || "")}</span>
        <span>${escapeHTML(t.archivedAt || "")}</span>
      </div>
    `;
    archiveList.appendChild(div);
  });
}

/* =========================
   DRAG & DROP
========================= */
function enableDragAndDrop() {
  document.querySelectorAll(".tasks-container").forEach((col) => {
    col.ondragover = (e) => e.preventDefault();
    col.ondrop = (e) => {
      const id = +e.dataTransfer.getData("id");
      const t = tasks.find((x) => x.id === id);
      if (!t) return;

      const rawKey = String(col.parentElement?.dataset?.dept || "").toLowerCase();

      // ✅ FIX: dropping into Done sets status only (keeps department)
      if (rawKey === DONE_KEY) {
        t.status = "done";
      } else {
        // leaving Done or moving between departments
        t.status = "";
        const deptKey = normalizeDeptKey(rawKey);
        t.department = keyToLabel(deptKey);
      }

      persistAll();
      sbScheduleSave();
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
   EXPORT CSV
   Title | Description | Update | Department | Owner
========================= */
function exportToCSV() {
  if (!tasks.length) return alert("No tasks to export");

  const header = ["Title", "Description", "Update", "Department", "Owner"];
  const rows = [];

  DEPT_KEYS.forEach((deptKey) => {
    const deptLabel = KEY_TO_LABEL[deptKey];
    const group = tasks.filter((t) => !isDoneTask(t) && normalizeDeptKey(t.department) === deptKey);
    if (!group.length) return;

    rows.push(`${deptLabel}`);
    rows.push(header.join(","));

    group.forEach((t) => {
      const row = [t.title || "", t.desc || "", t.update || "", t.department || deptLabel, t.owner || ""].map(
        (v) => `"${String(v).replace(/"/g, '""')}"`
      );
      rows.push(row.join(","));
    });

    rows.push("");
  });

  // ✅ Include Done tasks as a separate section
  const doneTasks = tasks.filter((t) => isDoneTask(t));
  if (doneTasks.length) {
    rows.push("Done");
    rows.push(header.join(","));
    doneTasks.forEach((t) => {
      const row = [t.title || "", t.desc || "", t.update || "", t.department || "", t.owner || ""].map(
        (v) => `"${String(v).replace(/"/g, '""')}"`
      );
      rows.push(row.join(","));
    });
    rows.push("");
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tasks.csv";
  link.click();
}

/* =========================
   THEME
========================= */
function loadTheme() {
  const mode = localStorage.getItem("theme") || "light";
  document.body.classList.toggle("dark", mode === "dark");
  if (themeSwitch) themeSwitch.checked = mode === "dark";
}

function toggleTheme() {
  const isDark = !!themeSwitch?.checked;
  document.body.classList.toggle("dark", isDark);
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

/* =========================
   INIT
========================= */
async function init() {
  loadTheme();

  if (!(await requireAuth())) return;

  isAdmin = await checkAdmin();

  // Initial load
  await sbLoadAll();
  renderTasks();
  renderArchive();

  enableRealtime();

  // Buttons
  searchBtn?.addEventListener("click", doSearch);
  clearSearchBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    renderTasks();
  });

  exportCSVBtn?.addEventListener("click", exportToCSV);
  addTaskBtn?.addEventListener("click", () => openModal(null));
  logoutBtn?.addEventListener("click", doLogout);

  themeSwitch?.addEventListener("change", toggleTheme);

  saveBtn?.addEventListener("click", saveTask);
  cancelBtn?.addEventListener("click", closeModal);

  window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

init();
