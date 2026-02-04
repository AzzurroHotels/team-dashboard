// auth.js
import { supabase, isSupabaseConfigured } from "./supabase-config.js";

const $ = (id) => document.getElementById(id);

const btnShowSignup = $("btnShowSignup");
const btnShowReset = $("btnShowReset");

const panelSignup = $("panel-signup");
const panelReset = $("panel-reset");

const loginForm = $("loginForm");
const signupForm = $("signupForm");
const resetForm = $("resetForm");

const msg = $("msg");

function setMsg(text, type) {
  msg.className = "msg" + (type ? " " + type : "");
  msg.textContent = text || "";
}

function hidePanels() {
  panelSignup.classList.add("hidden");
  panelReset.classList.add("hidden");
}

btnShowSignup.addEventListener("click", () => {
  const willShow = panelSignup.classList.contains("hidden");
  hidePanels();
  if (willShow) panelSignup.classList.remove("hidden");
  setMsg("", "");
});

btnShowReset.addEventListener("click", () => {
  const willShow = panelReset.classList.contains("hidden");
  hidePanels();
  if (willShow) panelReset.classList.remove("hidden");
  setMsg("", "");
});

async function redirectIfLoggedIn() {
  if (!isSupabaseConfigured()) {
    setMsg("Supabase is not configured yet. Please paste your URL + anon key in supabase-config.js.", "err");
    return;
  }
  const { data } = await supabase.auth.getSession();
  if (data?.session) window.location.href = "./app.html";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isSupabaseConfigured()) {
    setMsg("Supabase is not configured yet. Please paste your URL + anon key in supabase-config.js.", "err");
    return;
  }
  setMsg("Signing in…", "");

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return setMsg(error.message || "Login failed.", "err");

  setMsg("Login successful. Redirecting…", "ok");
  window.location.href = "./app.html";
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isSupabaseConfigured()) {
    setMsg("Supabase is not configured yet. Please paste your URL + anon key in supabase-config.js.", "err");
    return;
  }
  setMsg("Creating account…", "");

  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return setMsg(error.message || "Signup failed.", "err");

  setMsg("Account created. If email confirmation is enabled, please confirm then login.", "ok");
  panelSignup.classList.add("hidden");
});

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isSupabaseConfigured()) {
    setMsg("Supabase is not configured yet. Please paste your URL + anon key in supabase-config.js.", "err");
    return;
  }
  const email = $("resetEmail").value.trim();
  setMsg("Sending reset email…", "");
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return setMsg(error.message || "Failed to send reset email.", "err");
  setMsg("Password reset email sent.", "ok");
});

redirectIfLoggedIn();
