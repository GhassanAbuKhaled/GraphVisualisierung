let randomColors;
let mainSet;
let orderOfVertices;

function startColoring() {
  orderOfVertices = [];
  randomColors = [];
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

function getRandomColor() {
  for (let i = 0; i <= mainSet.length; i++) {
    let r = Math.floor(Math.random() * 256);
    let g = Math.floor(Math.random() * 256);
    let b = Math.floor(Math.random() * 256);
    let c = "rgb(" + r + "," + g + "," + b + ")";
    if (!randomColors.includes(c) && r + g + b != 0) {
      randomColors[i] = c;
    }
  }
}

function ShowSolution() {
  getRandomColor();
  mainSet.forEach((set, i) => {
    set.forEach((value, j) => {
      d3.select(`circle:nth-of-type(${value + 1})`)
        .transition()
        .duration(100)
        .style("fill", randomColors[i]);
    });
  });
  d3.select("#h1").text(`Number of Colors: ${mainSet.length}`);
}
