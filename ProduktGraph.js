function getadjacencyProductPower() {
  const n = graphProperty.numberOfnodes;
  let power = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0)
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        power[i][j] = 1;
      } else if (graphProperty.adjcentyMatrix[i][j]) {
        power[i][j] = 1;
      }
    }
  }

  for (let k = 2; k <= graphProperty.coloringDistances; k++) {
    let nextPower = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => 0)
    );
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let l = 0; l < n; l++) {
          if (graphProperty.adjcentyMatrix[i][l] && power[l][j]) {
            nextPower[i][j] = 1;
            break;
          }
        }
      }
    }
    power = nextPower;
  }

  removeOldGraphAndInitializeNew();
  graphProperty.graphProduct = graphGenerator(false, power);
  graphProperty.distance = true;
  startDisplay();
}
