function getWeekKey(date = new Date()) {
  const year = date.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date - oneJan) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${week.toString().padStart(2, "0")}`;
}

async function uploadFileAndGetURL(file, path) {
  if (!file) return null;
  const fileRef = window.storage.ref(path);
  const snapshot = await fileRef.put(file);
  return snapshot.ref.getDownloadURL();
}

function getAutomatCode() {
  const automatSelect = document.getElementById("automatSelect");
  return automatSelect ? String(automatSelect.value || "").trim() : "";
}

function setWochenStatus(message, tone) {
  const status = document.getElementById("wochenStatus");
  if (!status) return;
  status.textContent = message || "";
  status.classList.remove("error", "success");
  if (tone) status.classList.add(tone);
}

async function saveWochenWartung() {
  const automatCode = getAutomatCode();
  if (!automatCode) {
    setWochenStatus("Bitte zuerst einen Automaten auswählen.", "error");
    return;
  }

  const tasks = {
    wk_brennerkopf_oeffnen: {
      checkboxId: "wk_brennerkopf_oeffnen",
      fileId: "foto_wk_brennerkopf_oeffnen",
    },
    wk_wasserbehaelter_reinigen: {
      checkboxId: "wk_wasserbehaelter_reinigen",
      fileId: "foto_wk_wasserbehaelter_reinigen",
    },
    wk_entkalkung_frischwasser: {
      checkboxId: "wk_entkalkung_frischwasser",
      fileId: "foto_wk_entkalkung_frischwasser",
    },
    wk_brenner_rundum: {
      checkboxId: "wk_brenner_rundum",
      fileId: "foto_wk_brenner_rundum",
    },
  };

  const taskPayload = {};
  let allDone = true;
  let fotoURL = null;

  for (const [taskId, cfg] of Object.entries(tasks)) {
    const checkbox = document.getElementById(cfg.checkboxId);
    const fileInput = document.getElementById(cfg.fileId);
    const done = checkbox ? checkbox.checked : false;
    const doneAt = done ? new Date() : null;

    if (!done) allDone = false;

    const file = fileInput?.files?.[0] || null;
    if (!fotoURL && file) {
      const path = `wochenwartung/${automatCode}/${Date.now()}_${file.name}`;
      fotoURL = await uploadFileAndGetURL(file, path);
    }

    taskPayload[taskId] = { done, doneAt };
  }

  const payload = {
    automatCode,
    woche: getWeekKey(),
    tasks: taskPayload,
    status: allDone ? "erledigt" : "teilweise",
    updatedAt: new Date(),
  };

  if (fotoURL) payload.fotoURL = fotoURL;

  try {
    const query = await window.db
      .collection("wochenWartung")
      .where("automatCode", "==", automatCode)
      .where("woche", "==", payload.woche)
      .limit(1)
      .get();

    if (query.empty) {
      payload.createdAt = new Date();
      await window.db.collection("wochenWartung").add(payload);
    } else {
      await query.docs[0].ref.update(payload);
    }

    setWochenStatus("✅ Wochenwartung gespeichert.", "success");
  } catch (error) {
    setWochenStatus(`❌ Fehler beim Speichern: ${error.message}`, "error");
  }
}

function login() {
  const status = document.getElementById("status");
  const form = document.getElementById("cleaningForm");
  if (status) status.textContent = "Login gespeichert.";
  if (form) form.style.display = "block";
}

function saveWartung() {
  const status = document.getElementById("wartungStatus");
  if (status) status.textContent = "Wartung wird gespeichert…";
}

function saveCleaning() {
  const status = document.getElementById("status");
  if (status) status.textContent = "Reinigung wird gespeichert…";
}

function onWartungToggle() {
  return;
}

window.saveWochenWartung = saveWochenWartung;
window.login = login;
window.saveWartung = saveWartung;
window.saveCleaning = saveCleaning;
window.onWartungToggle = onWartungToggle;
