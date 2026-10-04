// ===== Step 1: Starting data =====
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// ===== Step 2: searchNotes =====
function searchNotes(word) {
  return notes.filter(function (note) {
    return note.text.toLowerCase().includes(word.toLowerCase());
  });
}

// ===== Step 3: longestNote =====
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].text.length > longest.text.length) {
      longest = notes[i];
    }
  }
  return longest;
}

// ===== Step 4: countByCategory =====
function countByCategory() {
  let counts = {};
  for (let i = 0; i < notes.length; i++) {
    let category = notes[i].category;
    if (counts[category] === undefined) {
      counts[category] = 1;
    } else {
      counts[category] = counts[category] + 1;
    }
  }
  return counts;
}

// ===== Step 5: getSummary =====
function getSummary() {
  let counts = countByCategory();
  let total = notes.length;
  let word = total === 1 ? "note" : "notes";

  let parts = [];
  for (let category in counts) {
    parts.push(`${counts[category]} ${category}`);
  }

  return `${total} ${word}: ${parts.join(", ")}.`;
}

// ===== Step 6: isDuplicate =====
function isDuplicate(text) {
  let cleaned = text.trim().toLowerCase().replace(/\s+/g, " ");
  return notes.some(function (note) {
    let existing = note.text.trim().toLowerCase().replace(/\s+/g, " ");
    return existing === cleaned;
  });
}

// ===== Step 7: addNote =====
function addNote(text, category) {
  let cleanText = text.trim();
  let allowed = ["personal", "work", "study"];

  if (cleanText.length < 1 || cleanText.length > 200) {
    console.log("Not added: text must be 1 to 200 characters.");
    return false;
  }
  if (isDuplicate(cleanText)) {
    console.log("Not added: this note already exists.");
    return false;
  }
  if (!allowed.includes(category)) {
    console.log("Not added: category must be personal, work or study.");
    return false;
  }

  let newId = notes.length === 0 ? 1 : notes[notes.length - 1].id + 1;
  notes.push({ id: newId, text: cleanText, category: category });
  return true;
}

// ===== Step 8: Tests (expected output in comments) =====

// searchNotes
console.log(searchNotes("call"));
// Expected: [ { id: 5, text: "Call mum", category: "personal" } ]
console.log(searchNotes("banana"));
// Expected: [] (no results)

// longestNote
console.log(longestNote());
// Expected: { id: 3, text: "Email the project report to Grace", category: "work" }
let backup = notes;   // keep the real notes safe
notes = [];           // pretend the list is empty
console.log(longestNote());
// Expected: null
notes = backup;       // put the notes back

// countByCategory
console.log(countByCategory());
// Expected: { personal: 2, study: 2, work: 1 }
notes = [];
console.log(countByCategory());
// Expected: {} (empty object)
notes = backup;

// getSummary
console.log(getSummary());
// Expected: "5 notes: 2 personal, 2 study, 1 work."
notes = [{ id: 1, text: "Only one", category: "work" }];
console.log(getSummary());
// Expected: "1 note: 1 work."
notes = backup;

// isDuplicate
console.log(isDuplicate("  buy MILK   and bread "));
// Expected: true (ignores case and extra spaces)
console.log(isDuplicate("Walk the dog"));
// Expected: false

// addNote
console.log(addNote("Walk the dog", "personal"));
// Expected: true
console.log(addNote("walk the dog", "personal"));
// Expected: logs "Not added: this note already exists." then false
console.log(addNote("", "work"));
// Expected: logs "Not added: text must be 1 to 200 characters." then false
console.log(addNote("Plan the week", "hobby"));
// Expected: logs "Not added: category must be personal, work or study." then false