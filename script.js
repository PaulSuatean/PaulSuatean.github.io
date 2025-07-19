let familyTree;

function renderPerson(person, parentArray, index, isSpouse = false) {
  const container = document.createElement("div");
  container.className = "person";
  if (!isSpouse) {
    container.classList.add("bloodline");
  }

  if (person.image) {
    const img = document.createElement("img");
    img.src = person.image;
    container.appendChild(img);
  }

  const nameSpan = document.createElement("span");
  nameSpan.textContent = person.name;
  container.appendChild(nameSpan);

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";

  // Handle spouse rendering
  if (person.spouse && !isSpouse) {
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
    childrenContainer.style.justifyContent = "space-evenly";
    childrenContainer.style.flexWrap = "wrap";
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
  treeDiv.appendChild(renderPerson(familyTree, null, null));
}

function loadTree() {
  const localData = localStorage.getItem('familyTree');
  if (localData) {
    familyTree = JSON.parse(localData);
    renderTree();
  } else {
    fetch('family.json')
      .then(response => response.json())
      .then(data => {
        familyTree = data;
        renderTree();
        localStorage.setItem('familyTree', JSON.stringify(familyTree));
      })
      .catch(error => {
        console.error('Error loading family.json:', error);
        familyTree = { name: "Grandparent 1" }; // Fallback
        renderTree();
      });
  }
}

loadTree();

document.getElementById('resetBtn').onclick = () => {
  localStorage.removeItem('familyTree');
  location.reload();
};