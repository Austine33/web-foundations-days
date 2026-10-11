// Select the elements
const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const status = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

// Step 3: array that stores the loaded users
let allUsers = [];

// Step 3: draw any list of users on the page
function renderUsers(list) {
  usersList.textContent = "";

  if (list.length === 0) {
    const message = document.createElement("li");
    message.textContent = "No users match your filter.";
    usersList.appendChild(message);
    return;
  }

  for (let i = 0; i < list.length; i++) {
    const user = list[i];

    const li = document.createElement("li");
    li.textContent =
      user.name + " | " + user.email + " | " + user.address.city + " | " + user.company.name;

    usersList.appendChild(li);
  }
} 

// Step 2: load users from the internet
async function loadUsers() {
  status.textContent = "Loading...";
  loadButton.disabled = true;

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/users");

    if (!response.ok) {
      throw new Error("Server error: " + response.status);
    }

    allUsers = await response.json();
    renderUsers(allUsers);
    status.textContent = "Loaded " + allUsers.length + " users.";
  } catch (error) {
    status.textContent = "Error: could not load users. " + error.message;
  } finally {
    loadButton.disabled = false;
  }
}

// Step 4: filter the stored users (no new request)
function filterUsers() {
  const text = filterInput.value.trim().toLowerCase();

  const filtered = allUsers.filter(function (user) {
    return user.name.toLowerCase().includes(text);
  });

  // Only show "No users match" once users have been loaded
  if (allUsers.length > 0) {
    renderUsers(filtered);
  }
}

loadButton.addEventListener("click", loadUsers);
filterInput.addEventListener("input", filterUsers);