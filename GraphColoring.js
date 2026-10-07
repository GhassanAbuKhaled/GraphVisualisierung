let mainSet;
let orderOfVertices;

function startColoring() {
  orderOfVertices = [];
  if (graphProperty.tryAgain) {
    mainSet = [new Set()];
  }
  greedyColoring();
}

function shufflSets() {
  for (let i = mainSet.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mainSet[i], mainSet[j]] = [mainSet[j], mainSet[i]];
  }
  for (const set of mainSet) {
    for (const v of set) {
      orderOfVertices.push(v);
    }
  }
  mainSet = [new Set()];
  return orderOfVertices;
}

function getOrderOfVertices() {
  graphProperty.tryAgain = false;
  // Populate the orderOfVertices array with the vertex IDs
  for (let i = 0; i < graphProperty.nodes.length; i++) {
    orderOfVertices.push(graphProperty.nodes[i].id);
  }
  // Perform the Fisher-Yates shuffle
  for (let i = orderOfVertices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [orderOfVertices[i], orderOfVertices[j]] = [
      orderOfVertices[j],
      orderOfVertices[i],
    ];
  }
  return orderOfVertices;
}

function isIndependentSet(matrix,set, v) {
  return ![...set].some((vertex) => matrix[v][vertex]);
}

function greedyColoring() {

  let matrix = (graphProperty.distance) ? [...graphProperty.graphProduct] : { ...graphProperty.adjcentyMatrix };

  if (graphProperty.tryAgain) {
    orderOfVertices = getOrderOfVertices();
  } else {
    orderOfVertices = shufflSets();
  }
  for (const v of orderOfVertices) {
    let foundIndependentSet = false;
    for (const set of mainSet) {
      if (isIndependentSet(matrix,set, v)) {
        set.add(v);
        foundIndependentSet = true;
        break;
      }
    }
    if (!foundIndependentSet) {
      mainSet.push(new Set([v]));
    }
  }
  ShowSolution();
}

// One distinct color per set: a fixed palette for up to 10 sets,
// otherwise hues spread evenly around the color wheel
function getColor(i, count) {
  return count <= d3.schemeTableau10.length
    ? d3.schemeTableau10[i]
    : d3.interpolateSinebow(i / count);
}

function ShowSolution() {
  mainSet.forEach((set, i) => {
    set.forEach((value) => {
      d3.select(`circle:nth-of-type(${value + 1})`)
        .transition()
        .duration(100)
        .style("fill", getColor(i, mainSet.length));
    });
  });
  d3.select("#status").text(`Number of Colors: ${mainSet.length}`);
}
