const familyTree = {
  name: "Grandparent",
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
};

function renderPerson(person) {
  const container = document.createElement("div");
  container.className = "person";
  container.textContent = person.name;

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";
  wrapper.appendChild(container);

  if (person.children && person.children.length > 0) {
    const connector = document.createElement("div");
    connector.className = "connector";
    wrapper.appendChild(connector);

    const childrenContainer = document.createElement("div");
    childrenContainer.style.display = "flex";
    childrenContainer.style.gap = "1rem";
    person.children.forEach(child => {
      childrenContainer.appendChild(renderPerson(child));
    });

    wrapper.appendChild(childrenContainer);
  }

  return wrapper;
}

document.getElementById("tree").appendChild(renderPerson(familyTree));
