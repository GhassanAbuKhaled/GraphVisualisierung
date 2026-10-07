let width, height, node, label, link;

function startDisplay() {
  (width = +svg.node().getBoundingClientRect().width),
    (height = +svg.node().getBoundingClientRect().height),
    (link = svg
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(graphProperty.links)
      .enter()
      .append("line"));

  node = svg
    .append("g")
    .selectAll("circle")
    .data(graphProperty.nodes)
    .enter()
    .append("circle")
    .attr("r", graphProperty.nodeSize)
    .attr("fill", "black");

  label = svg
    .append("g")
    .selectAll("text")
    .data(graphProperty.nodes)
    .enter()
    .append("text")
    .text(function (d) {
      return d.id;
    })
    .attr("x", 4)
    .attr("y", ".35em")
    .style("fill", "black")
    .attr("dx", 10) // add extra horizontal spacing
    .attr("dy", 5); // add extra vertical spacing;
  // Call drag behavior on nodes after simulation is defined
  node.call(drag(simulation));
  simulationInzialization();
}

function simulationInzialization() {
  simulation
    .nodes(graphProperty.nodes)
    .force("link", d3.forceLink())
    .force("charge", d3.forceManyBody())
    .force("collide", d3.forceCollide())
    .force("center", d3.forceCenter())
    .force("forceX", d3.forceX())
    .force("forceY", d3.forceY());

  simulation.on("tick", ticked);
  updateSimulation();
}

function updateSimulation() {
  simulation.force("charge", d3.forceManyBody().strength(-30));
  simulation.force("center", d3.forceCenter(width / 2, height / 2));
  simulation.force(
    "collision",
    d3.forceCollide().radius(graphProperty.radius).strength(0.001)
  ); // add collision detection
  simulation
    .force("forceX")
    .strength(graphProperty.horizontalAlignment)
    .x((d) => {
      // keep nodes within the container div horizontally
      return Math.max(
        graphProperty.radius,
        Math.min(width - graphProperty.radius, d.x)
      );
    });

  simulation
    .force("forceY")
    .strength(graphProperty.verticalAlignment)
    .y((d) => {
      // keep nodes within the container div vertically
      return Math.max(
        graphProperty.radius,
        Math.min(height - graphProperty.radius, d.y)
      );
    });
  simulation
    .force("link")
    .links(graphProperty.links)
    .distance(graphProperty.edgesDistance)
    .id(function (d) {
      return d.id;
    });
  simulation.alpha(1).restart();
}
// Space kept free between the nodes and the border of the drawing area,
// large enough for the node labels on the right
const BORDER_PADDING = 30;

function ticked() {
  // Keep every node inside the drawing area, also on narrow screens
  graphProperty.nodes.forEach((d) => {
    d.x = Math.max(BORDER_PADDING, Math.min(width - BORDER_PADDING, d.x));
    d.y = Math.max(BORDER_PADDING, Math.min(height - BORDER_PADDING, d.y));
  });

  node
    .attr("cx", function (d) {
      return d.x;
    })
    .attr("cy", function (d) {
      return d.y;
    });

  link
    .attr("x1", function (d) {
      return d.source.x;
    })
    .attr("y1", function (d) {
      return d.source.y;
    })
    .attr("x2", function (d) {
      return d.target.x;
    })
    .attr("y2", function (d) {
      return d.target.y;
    });

  label
    .attr("x", function (d) {
      return d.x;
    })
    .attr("y", function (d) {
      return d.y;
    });
}

function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.6).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  return d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

function updateDisplayNodeAndLink(){
  node.attr("r",graphProperty.nodeSize)
  link.attr("opacity" , graphProperty.edgesOpacity)
}
d3.select(window).on("resize", function () {
  width = +svg.node().getBoundingClientRect().width;
  height = +svg.node().getBoundingClientRect().height;
  updateSimulation();
});
