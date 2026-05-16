import { auth, db, googleProvider } from "./firebase.js";

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// *** AUTH ***
async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    console.log(`Signed in successfully as: ${user.email}`);
  } catch (error) {
    console.error("Authentication failed: ", error);
  }
}

async function logoutApp() {
  try {
    await signOut(auth);
    console.log("Logged out successfully.");
  } catch (error) {
    console.error("Error signing out: ", error);
  }
}

// *** CONSTANTS // STATES ***
// *** LIST ***
let list = [];

let selectedPet = "";
let selectedStat = "";
let detailsEdit = false;

// *** SELECTORS ***
const addPetBtn = document.getElementById("addPetBtn");
const petList = document.getElementById("pet-list");
const summary = document.getElementById("summary");
const delSafeguard = document.getElementById("delete-safeguard");
const details = document.getElementById("details");
const popup = document.getElementById("popup");
const addPetForm = document.getElementById("addPetForm");
const cancelForm = document.getElementById("closePetForm");
const addStatForm = document.getElementById("add-stat");
const sidebarPet = document.querySelector(".sidebar");

// *** Initialization ***

const authStatus = document.getElementById("auth-status");
const authBtn = document.getElementById("auth-btn");

let currentUser = null;
let unsubscribeSnapshot = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const whitelistDocRef = doc(
        db,
        "whitelist",
        user.email.toLowerCase().trim(),
      );
      const docSnap = await getDoc(whitelistDocRef);

      if (docSnap.exists() && docSnap.data().allowed === true) {
        currentUser = user;
        authStatus.textContent = user.email.split("@")[0];
        authBtn.textContent = "Sign Out";
        console.log("Access granted for whitelisted user: ", user.email);

        startListeningToPets();
      } else {
        console.warn("Access denied. Email not whitelisted: ", user.email);
        authStatus.textContent = `Denied`;
        authBtn.textContent = "Sign Out";

        clearAppState();
      }
    } catch (e) {
      console.error("Error reading whitelist entry: ", e);
      authStatus.textContent = "Error checking authorization profile.";
      clearAppState();
    }
  } else {
    currentUser = null;
    authStatus.textContent = `You are currently signed out.`;
    authBtn.textContent = "Sign in with Google";

    clearAppState();
  }
});

function startListeningToPets() {
  if (unsubscribeSnapshot) return;

  unsubscribeSnapshot = onSnapshot(collection(db, "pets"), (snapshot) => {
    list = [];

    snapshot.forEach((doc) => {
      const petData = doc.data();
      petData.id = doc.id;
      list.push(petData);
    });
    console.log("Local application state synchronized with could data:", list);

    renderPetList();

    if (selectedPet) {
      const updatedPet = list.find((x) => x.id === selectedPet.id);
      setSelectedPet(updatedPet || "");
      renderSummary(updatedPet);
    } else {
      renderSummary("");
    }
  });
}

// *** CORE FUNCTIONS ***

async function createPet(name, species, birth) {
  try {
    const petsCollectionRef = collection(db, "pets");
    await addDoc(petsCollectionRef, {
      name: name,
      species: species,
      birth: birth,
      vaccines: [],
      spotOn: [],
      antiparasitics: [],
      weight: [],
      foodBrand: [],
      foodDosage: [],
    });

    console.log("New pet successfully written to the could database!");
  } catch (error) {
    console.error("Error adding pet document: ", error);
  }
}

async function deletePet(selectedPet) {
  {
    try {
      const petDocRef = doc(db, "pets", selectedPet.id);

      await deleteDoc(petDocRef);
      console.log("Pet successfully deleted from the cloud database!");
    } catch (error) {
      console.error("Error deleting pet document: ", error);
    }
  }
  list = list.filter((x) => x.id !== selectedPet.id);
}

function setSelectedPet(pet) {
  selectedPet = pet;
}

function setSelectedStat(stat) {
  selectedStat = stat;
}

async function addStat(pet, stat, value, date) {
  try {
    const petDocRef = doc(db, "pets", pet.id);
    const newEntry = {
      id: crypto.randomUUID(),
      value: value,
      date: date,
    };
    await updateDoc(petDocRef, {
      [stat]: arrayUnion(newEntry),
    });
    console.log(`Successfully added new metric entry to ${stat}`);

    const currentPetState = list.find((x) => x.id === pet.id);
    if (currentPetState) renderDetails(currentPetState, stat);
  } catch (error) {
    console.error("Error adding metric entry: ", error);
  }
}

async function deleteStat(id) {
  try {
    const petDocRef = doc(db, "pets", selectedPet.id);
    const targetEntry = selectedPet[selectedStat].find((x) => x.id === id);
    if (!targetEntry) return;

    await updateDoc(petDocRef, {
      [selectedStat]: arrayRemove(targetEntry),
    });

    console.log("Metric entry successfully removed from cloud sub-array!");
    const currentPetState = list.find((x) => x.id === selectedPet.id);
    if (currentPetState) renderDetails(currentPetState, selectedStat);
  } catch (error) {
    console.error("Error deleting metric entry: ", error);
  }
}
// *** RENDER FUNCTIONS ***

function showAddPetForm() {
  showView(popup);
  showView(addPetForm);
}

function hideAddPetForm() {
  hideView(popup);
  hideView(addPetForm);
  addPetForm.reset();
}

function showView(view) {
  view.classList.remove("hidden");
}
function hideView(view) {
  view.classList.add("hidden");
}

function renderPetList() {
  petList.innerHTML = "";
  list.forEach((x) => {
    const listItem = document.createElement("li");
    listItem.innerText = x.name;
    listItem.dataset.id = x.id;
    if (selectedPet && selectedPet.id === x.id)
      listItem.classList.add("selected");
    petList.append(listItem);
  });
}

function renderSummary(pet) {
  if (!pet) {
    summary.innerHTML = `<h1>Add or Select a pet!</h1>`;
    return;
  }

  const temp = document.getElementById("summary-template");
  const clone = temp.content.cloneNode(true);

  summary.innerHTML = "";

  clone.querySelector("#sum-pet-name").innerText = pet.name;
  clone.querySelector("#sum-pet-age").innerText = calcAge(pet) || "";

  const statTypes = ["weight", "spotOn", "antiparasitics", "vaccines"];

  statTypes.forEach((x) => {
    const group = clone.querySelector(`[data-type="${x}"]`);

    const latest = findLatestEntry(pet[x]);
    const daysPassed = latest ? findDaysPassed(latest.date) : null;

    const badge = group.querySelector(`.time-elapsed`);
    badge.innerText = daysPassed !== null ? `${daysPassed}d` : "---";
    badge.dataset.status = checkFrequency(x, daysPassed);

    const valueEl = group.querySelector(".value");
    const dateEl = group.querySelector(".date");

    if (valueEl) valueEl.innerText = latest?.value ?? "";
    if (dateEl)
      dateEl.innerText = latest?.date ? greekDate(latest.date) : "---";
  });

  summary.appendChild(clone);
}

function renderDelPetSafeguard() {
  delSafeguard.querySelector("h2").innerHTML = `Delete ${selectedPet.name} ?`;
  showView(delSafeguard);
  showView(popup);
}

function renderDetails(pet, stat) {
  const temp = document.getElementById("details-template");
  const clone = temp.content.cloneNode(true);

  details.innerHTML = "";

  clone.querySelector("#det-pet-name").innerText = selectedPet.name;

  details.appendChild(clone);

  if (selectedPet[stat].length) {
    [...selectedPet[stat]]
      // *** SORT ARRAY ***
      .sort((a, b) => dateToNumber(b.date) - dateToNumber(a.date))
      .forEach((x) => {
        // *** LIST GENERATION ***
        const listGroup = document.createElement("div");
        listGroup.classList.add("det-list-group");
        listGroup.dataset.id = x.id;
        const listItemValue = document.createElement("span");
        selectedStat === "weight"
          ? (listItemValue.innerText = x.value + "kg")
          : (listItemValue.innerText = x.value || "");

        const listItemDate = document.createElement("span");
        listItemDate.innerText = greekDate(x.date);
        const listDelBtn = document.createElement("button");
        listDelBtn.innerText = "×";
        listDelBtn.classList.add("del-entry-btn");
        if (detailsEdit) listDelBtn.classList.add("v-show");

        listGroup.append(listItemValue, listItemDate, listDelBtn);
        details.appendChild(listGroup);
      });
  } else {
    const noEntries = document.createElement("div");
    noEntries.innerText = "No entries yet...";
    details.appendChild(noEntries);
  }

  showView(popup);
  showView(details);
}

function hideDetails() {
  hideView(popup);
  hideView(details);
}

function renderAddStatForm(pet, stat) {
  const temp = document.getElementById("add-stat-template");
  const clone = temp.content.cloneNode(true);

  addStatForm.innerHTML = "";

  if (stat !== "vaccines") {
    clone.querySelector(`[data-type="${stat}"]`).classList.remove("hidden");
    clone.querySelector(`[data-type="${stat}"] input`).required = true;
  }
  addStatForm.appendChild(clone);
  showView(popup);
  showView(addStatForm);
  hideView(details);
}

function hideStatForm() {
  hideView(addStatForm);
  hideView(popup);
}

function showDetailsEdit() {
  details
    .querySelectorAll(".del-entry-btn")
    .forEach((x) => x.classList.add("v-show"));
}

function hideDetailsEdit() {
  details
    .querySelectorAll(".del-entry-btn")
    .forEach((x) => x.classList.remove("v-show"));
}

// *** HELPER FUNCTIONS ***
function clearAppState() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  list = [];
  renderPetList();
  renderSummary("");
}

function dateToNumber(date) {
  return Number(date.split("-").join(""));
}

function findLatestEntry(array) {
  if (!array || array.length === 0) return null;
  let entry = array.reduce((acc, curr) => {
    return dateToNumber(acc.date) < dateToNumber(curr.date) ? curr : acc;
  }, array[0]);
  return entry;
}

function findDaysPassed(date) {
  if (date) {
    const past = new Date(date);
    past.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = now - past;

    // return String(Math.floor(diff / (1000 * 60 * 60 * 24)));
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  } else return null;
}

function calcAge(pet) {
  const birth = new Date(pet.birth);
  birth.setHours(0, 0, 0, 0);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const diff = now - birth;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  return `(${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m)`;
}

function checkFrequency(stat, days) {
  if (days !== null && days !== undefined) {
    if (stat === "weight" || stat === "spotOn") {
      return days < 14 ? "safe" : days < 30 ? "warning" : "expired";
    }
    if (stat === "antiparasitics") {
      return days < 90 ? "safe" : days < 180 ? "warning" : "expired";
    }
    if (stat === "vaccines") {
      return days < 335 ? "safe" : days < 365 ? "warning" : "expired";
    }
  } else return;
}

function greekDate(date) {
  if (date) {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  } else return "";
}

// *** LISTENERS ***
addPetBtn.addEventListener("click", () => {
  showAddPetForm();
});

addPetForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const name = data.get("petName");
  const species = data.get("petSpecies");
  const birth = data.get("petBirth");
  if (name && species && birth) {
    createPet(name, species, birth);
    hideAddPetForm();
    renderPetList();
  }
});

cancelForm.addEventListener("click", () => {
  hideAddPetForm();
});

sidebarPet.addEventListener("click", (e) => {
  if (e.target.closest("li")) {
    let petId = e.target.closest("li").dataset.id;
    let sumPet = list.find((x) => x.id === petId);

    setSelectedPet(sumPet);
    setSelectedStat("");

    renderPetList();
    renderSummary(sumPet);
  }
});

summary.addEventListener("click", (e) => {
  // *** STAT GROUP IS CLICKED ***
  const group = e.target.closest(".sum-list-group");
  const delPetBtn = e.target.closest("#deletePetBtn");

  if (group) {
    const stat = group.dataset.type;

    setSelectedStat(stat);

    renderDetails(selectedPet, selectedStat);
  }
  // *** DELETE PET IS CLICKED ***
  else if (delPetBtn) {
    renderDelPetSafeguard();
  } else return;
});

delSafeguard.addEventListener("click", (e) => {
  const yes = "safeguard-yes";
  const no = "safeguard-no";
  if (e.target.id === yes) {
    deletePet(selectedPet);
    setSelectedPet("");
    renderPetList();
    renderSummary("");
    hideView(popup);
    hideView(delSafeguard);
  }
  if (e.target.id === no) {
    hideView(popup);
    hideView(delSafeguard);
  }
});

details.addEventListener("click", (e) => {
  const target = e.target.classList;
  // *** CLOSE DETAILS ***
  if (target.contains("det-close-btn")) {
    hideDetails();
    detailsEdit = false;
  }
  // *** ADD STAT FORM ***
  if (target.contains("add-stat-btn")) {
    renderAddStatForm(selectedPet, selectedStat);
  }
  // *** EDIT BUTTON ***
  if (target.contains("det-edit-btn")) {
    if (!detailsEdit) {
      detailsEdit = true;
      showDetailsEdit();
      details.querySelector(".det-edit-btn").innerText = "Done";
    } else {
      detailsEdit = false;
      hideDetailsEdit();
      details.querySelector(".det-edit-btn").innerText = "Edit";
    }
  }
  // *** DEL STAT BUTTON ***
  if (target.contains("del-entry-btn")) {
    const id = e.target.closest(".det-list-group").dataset.id;

    deleteStat(id);
    renderSummary(selectedPet);
  }
});

addStatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = new FormData(e.target);
  const date = data.get("statDate");

  const fieldMap = {
    weight: "statWeight",
    spotOn: "statSpotOn",
    antiparasitics: "statAntiparasitics",
  };

  const value = data.get(fieldMap[selectedStat]) || "";

  addStat(selectedPet, selectedStat, value, date);
  hideStatForm();
  renderDetails(selectedPet, selectedStat);
  renderSummary(selectedPet);
});

addStatForm.addEventListener("click", (e) => {
  const target = e.target;

  if (target.className === "cancel-stat-btn") {
    hideStatForm();
    renderDetails(selectedPet, selectedStat);
  }
});

authBtn.addEventListener("click", () => {
  if (currentUser) {
    logoutApp();
  } else {
    loginWithGoogle();
  }
});
