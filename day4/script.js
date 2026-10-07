// Select all the elements
const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

// Update both counters and the warning colours
function updateCounts() {
  const text = noteText.value;
  const chars = text.length;

  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  charCount.textContent = chars + " / 200 characters";
  wordCount.textContent = words + (words === 1 ? " word" : " words");

  charCount.classList.remove("warning", "over");
  if (chars > 200) {
    charCount.classList.add("over");
  } else if (chars > 180) {
    charCount.classList.add("warning");
  }
}

// On every input, update counts and save the draft
noteText.addEventListener("input", function () {
  updateCounts();
  localStorage.setItem("draft", noteText.value);
});

// Clear everything
function clearAll() {
  noteText.value = "";
  localStorage.removeItem("draft");
  updateCounts();
}

clearBtn.addEventListener("click", clearAll);

noteText.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    clearAll();
  }
});

// Theme button
themeToggle.addEventListener("click", function () {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

// When the page loads, restore draft and theme
const savedDraft = localStorage.getItem("draft");
if (savedDraft !== null) {
  noteText.value = savedDraft;
}

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  themeToggle.textContent = "Light mode";
}

updateCounts();