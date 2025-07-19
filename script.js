const familyTree = [
  {
    name: "Grandparent 1",
    children: [
      {
        name: "Parent 1",
        children: [
          { name: "Child 1" },
          { name: "Child 2" }
        ]
      },
      {
        name: "Parent 2",
        children: [
          { name: "Child 3" },
          { name: "Child 4" }
        ]
      }
    ]
  },
  {
    name: "Grandparent 2",
    children: []
  }
];

function renderPerson(person, parentArray, index, isSpouse = false) {
  const container = document.createElement("div");
  container.className = "person";

  const nameSpan = document.createElement("span");
  nameSpan.textContent = person.name;
  container.appendChild(nameSpan);

  const buttons = document.createElement("div");
  buttons.className = "buttons";
  container.appendChild(buttons);

  // Add Spouse Button
  const addSpouseBtn = document.createElement("button");
  addSpouseBtn.textContent = "Add Spouse";
  addSpouseBtn.onclick = () => {
    const spouseName = prompt("Enter spouse name:");
    if (spouseName) {
      person.spouse = { name: spouseName };
      renderTree();
    }
  };
  buttons.appendChild(addSpouseBtn);

  // Remove Spouse Button (if spouse exists)
  if (person.spouse) {
    const removeSpouseBtn = document.createElement("button");
    removeSpouseBtn.textContent = "Remove Spouse";
    removeSpouseBtn.className = "remove";
    removeSpouseBtn.onclick = () => {
      delete person.spouse;
      renderTree();
    };
    buttons.appendChild(removeSpouseBtn);
  }

  // Add Child Button
  const addChildBtn = document.createElement("button");
  addChildBtn.textContent = "Add Child";
  addChildBtn.onclick = () => {
    const childName = prompt("Enter child name:");
    if (childName) {
      if (!person.children) person.children = [];
      person.children.push({ name: childName });
      renderTree();
    }
  };
  buttons.appendChild(addChildBtn);

  // Remove Person Button (not for top-level grandparents)
  if (parentArray && !isSpouse) {
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.className = "remove";
    removeBtn.onclick = () => {
      parentArray.splice(index, 1);
      renderTree();
    };
    buttons.appendChild(removeBtn);
  }

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";

  // Handle spouse rendering
  if (person.spouse) {
    const spouseContainer = document.createElement("div");
    spouseContainer.className = "spouse-container";
    spouseContainer.appendChild(container);
    spouseContainer.appendChild(renderPerson(person.spouse, null, null, true));
    wrapper.appendChild(spouseContainer);
  } else {
    wrapper.appendChild(container);
  }

  if (person.children && person.children.length > 0) {
    const connector = document.createElement("div");
    connector.className = "connector";
    wrapper.appendChild(connector);

    const childrenContainer = document.createElement("div");
    childrenContainer.style.display = "flex";
    childrenContainer.style.gap = "1rem";
    person.children.forEach((child, childIndex) => {
      childrenContainer.appendChild(renderPerson(child, person.children, childIndex));
    });

    wrapper.appendChild(childrenContainer);
  }

  return wrapper;
}

function renderTree() {
  const treeDiv = document.getElementById("tree");
  treeDiv.innerHTML = "";
  familyTree.forEach((grandparent, index) => {
    treeDiv.appendChild(renderPerson(grandparent, familyTree, index));
  });
}

renderTree();