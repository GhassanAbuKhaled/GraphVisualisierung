const graphProperty = {
  numberOfnodes: 10,
  edgesDensity: 0.6,
  nodes: [],
  links: [],
  adjcentyMatrix: [],
  CSRMatrix: {
    IA: [],
    JA: [],
  },
  graphProduct: [],
  coloringDistances: 1,
  edgesOpacity: 0.7,
  edgesDistance: 250,
  nodeSize: 6,
  horizontalAlignment: 0.078,
  verticalAlignment: 0.09,
  radius: 0.0001,
  tryAgain: true,
  distance: false
};
let svg;
let simulation;

getRandomGraph();

function getRandomGraph() {
  if (graphProperty.numberOfnodes >= 101) {
    d3.select("#h1").text(`Die Anzahl der Knoten ist so groß`);
    return;
  }
  removeOldGraphAndInitializeNew();
  graphProperty.coloringDistances = 1;
  d3.select("#distance-d").property("value", 1);
  graphProperty.adjcentyMatrix = graphGenerator(
    true,
    graphProperty.adjcentyMatrix
  );
  startDisplay();
}

function removeOldGraphAndInitializeNew() {
  d3.select("#h1").text("Graph Visualisierung");
  d3.select("#graph").selectAll("*").remove();
  svg = d3.select("#graph").append("svg").attr("class", "svg");
  simulation = d3.forceSimulation();
  graphProperty.nodes = [];
  graphProperty.links = [];
  graphProperty.tryAgain = true;
}

function graphGenerator(forRandomGraph, graph) {
  if (forRandomGraph)
    graph = Array.from({ length: graphProperty.numberOfnodes }, () =>
      Array(graphProperty.numberOfnodes).fill(0)
    );

    graphProperty.distance = false;

  for (let i = 0; i < graphProperty.numberOfnodes; i++) {
    graphProperty.nodes.push({ id: i });
    for (let j = i + 1; j < graphProperty.numberOfnodes; j++) {
      if (forRandomGraph && Math.random() <= graphProperty.edgesDensity) {
        graph[i][j] = 1;
        graph[j][i] = 1;
        graphProperty.links.push({ source: i, target: j });
      } else if (!forRandomGraph && graph[i][j]) {
        graphProperty.links.push({ source: i, target: j });
      }
    }
  }
  return graph;
}
