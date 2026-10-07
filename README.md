# Graph Visualization

An interactive web page that generates random graphs and colors them with a
greedy distance-d coloring algorithm. Vertices that are at most `d` edges apart
always receive different colors. It is the visual counterpart of the C
implementation in the companion project *Abschlussprojekt*.

Built with plain JavaScript and [D3.js](https://d3js.org/) (force-directed
layout). There is no build step.

## Run

Open `index.html` in a browser. An internet connection is needed because D3
and the font are loaded from a CDN.

## Usage

1. Choose the number of nodes and the edge density, then click
   **Generate Random Graph**.
2. Optionally set **Distance - d** (default `1`). The page then shows the
   distance-d graph, where every pair of vertices at most `d` edges apart is
   connected.
3. Click **Start Graph Coloring**. The status badge at the top right of
   the graph shows the number of colors used.
4. Click **Start Graph Coloring** again to search for a better coloring. Each
   new round keeps the previous color classes together in a shuffled order, so
   the number of colors never increases.

Nodes can be dragged with the mouse. On screens up to 1024 px wide, the
controls are in the menu behind the hamburger button.

### Controls

| Control          | Range        | Effect                                        |
| ---------------- | ------------ | --------------------------------------------- |
| Nodes            | 1 – 100      | Number of vertices in a new random graph      |
| Edge Density     | 0.1 – 1      | Probability that two vertices are connected   |
| Distance - d     | 1 – 60       | Coloring distance                             |
| Edge Opacity     | 0.1 – 1      | Transparency of the edges                     |
| Edge Distance    | 10 – 1000    | Preferred edge length in the layout           |
| Node Size        | 1 – 15       | Radius of the vertices                        |
| Horizontal Force | 0.001 – 10   | Keeps the vertices inside the drawing area (x) |
| Vertical Force   | 0.001 – 5    | Keeps the vertices inside the drawing area (y) |

## How it works

- **Random graph**: every pair of vertices is connected with probability
  *Edge Density*. The graph is stored as an adjacency matrix.
- **Distance-d graph**: starting from the adjacency matrix plus the identity,
  repeated boolean matrix products give all pairs of vertices within distance
  `d`.
- **Greedy coloring**: vertices are visited in a random order and each one is
  added to the first color class (independent set) that has no conflict with
  it. If there is none, a new color class is created.

## Project structure

| File               | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `index.html`       | Page layout, controls and sidebar menu                       |
| `style.css`        | Styling                                                      |
| `app.js`           | Drawing, force simulation and node dragging                  |
| `RandomGraph.js`   | Shared settings (`graphProperty`) and random graph generator |
| `ProduktGraph.js`  | Distance-d graph via adjacency matrix powers                 |
| `GraphColoring.js` | Greedy coloring and color display                            |

The order of the `<script>` tags in `index.html` matters: `RandomGraph.js` draws
the first graph as soon as it loads and uses functions from `app.js`, so
`app.js` must be loaded first.
