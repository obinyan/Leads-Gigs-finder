const ledger = document.getElementById("ledger");
const emptyState = document.getElementById("emptyState");
const rowTemplate = document.getElementById("leadRowTemplate");
const pollBtn = document.getElementById("pollBtn");
const pollStatus = document.getElementById("pollStatus");
const addBtn = document.getElementById("addBtn");
const addDialog = document.getElementById("addDialog");
const addForm = document.getElementById("addForm");
const cancelAdd = document.getElementById("cancelAdd");

let leads = [];
let filters = { status: "all", sort: "score" };

async function loadLeads() {
  const res = await fetch("/api/leads");
  leads = await res.json();
  render();
}

function scoreBand(score) {
  if (score === null || score === undefined) return "none";
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}

function applyFiltersAndSort(list) {
  let filtered = list;
  if (filters.status !== "all") {
    filtered = filtered.filter((l) => l.status === filters.status);
  }
  filtered = [...filtered].sort((a, b) => {
    if (filters.sort === "date") {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return (b.score ?? -1) - (a.score ?? -1);
  });
  return filtered;
}

function render() {
  const visible = applyFiltersAndSort(leads);
  ledger.querySelectorAll(".lead").forEach((el) => el.remove());
  emptyState.style.display = visible.length ? "none" : "block";

  for (const lead of visible) {
    const node = rowTemplate.content.cloneNode(true);
    const article = node.querySelector(".lead");
    article.dataset.id = lead.id;
    article.dataset.band = scoreBand(lead.score);

    node.querySelector(".lead-score").textContent = lead.score ?? "…";
    node.querySelector(".lead-title").textContent = lead.title;
    node.querySelector(".lead-source").textContent = lead.source;
    node.querySelector(".lead-reason").textContent = lead.scoreReason || "Not scored yet.";
    node.querySelector(".lead-budget").textContent = lead.budget || "budget unknown";
    node.querySelector(".lead-posted").textContent = new Date(lead.postedAt || lead.createdAt).toLocaleDateString();
    node.querySelector(".lead-description").textContent = lead.description || "No description provided.";

    const pill = node.querySelector(".lead-status-pill");
    pill.textContent = lead.status;
    pill.dataset.status = lead.status;

    const draftText = node.querySelector(".draft-text");
    const draftEmpty = node.querySelector(".draft-empty");
    const draftActions = node.querySelector(".draft-actions");
    const openLink = node.querySelector(".open-link");
    openLink.href = lead.sourceUrl || "#";

    if (lead.draftProposal) {
      draftText.value = lead.draftProposal;
      draftText.style.display = "block";
      draftActions.style.display = "flex";
      draftEmpty.style.display = "none";
    }

    node.querySelector(".copy-draft").addEventListener("click", () => {
      navigator.clipboard.writeText(draftText.value);
      flashStatus("Proposal copied.");
    });

    node.querySelector(".mark-applied").addEventListener("click", () => setStatus(lead.id, "applied"));
    node.querySelector(".mark-skipped").addEventListener("click", () => setStatus(lead.id, "skipped"));
    node.querySelector(".remove-lead").addEventListener("click", () => removeLead(lead.id));

    ledger.appendChild(node);
  }
}

async function setStatus(id, status) {
  await fetch(`/api/leads/${id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  await loadLeads();
}

async function removeLead(id) {
  await fetch(`/api/leads/${id}`, { method: "DELETE" });
  await loadLeads();
}

function flashStatus(msg) {
  pollStatus.textContent = msg;
  setTimeout(() => { pollStatus.textContent = ""; }, 2500);
}

pollBtn.addEventListener("click", async () => {
  pollBtn.disabled = true;
  flashStatus("Polling Freelancer.com & Google Search…");
  try {
    const res = await fetch("/api/poll", { method: "POST" });
    const result = await res.json();
    flashStatus(`Done — ${result.added} new lead(s) found.`);
  } catch (err) {
    flashStatus("Poll failed — check server logs.");
  }
  pollBtn.disabled = false;
  await loadLeads();
});

addBtn.addEventListener("click", () => addDialog.showModal());
cancelAdd.addEventListener("click", () => addDialog.close());

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(addForm);
  const payload = Object.fromEntries(formData.entries());
  flashStatus("Scoring lead…");
  const res = await fetch("/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    addForm.reset();
    addDialog.close();
    flashStatus("Lead added and scored.");
    await loadLeads();
  } else {
    const err = await res.json();
    flashStatus(err.error || "Could not add lead.");
  }
});

document.querySelectorAll('input[name="status"]').forEach((el) =>
  el.addEventListener("change", (e) => { filters.status = e.target.value; render(); })
);
document.querySelectorAll('input[name="sort"]').forEach((el) =>
  el.addEventListener("change", (e) => { filters.sort = e.target.value; render(); })
);

loadLeads();
