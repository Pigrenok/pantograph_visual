export function arraysEqual(A, B) {
  return (
    (A.length === 0 && B.length === 0) ||
    (A.length === B.length && A.every((e) => B.indexOf(e) > -1))
  );
}

export function filter_sort_index_array(array, zoom, sep = "_") {
  let sortedKeys = array.filter((index) => {
    return index.split(sep)[0] === zoom;
  });
  sortedKeys.sort((a, b) => {
    return Number(a.split(sep)[1]) - Number(b.split(sep)[1]);
  });

  return sortedKeys;
}
export function compKey(zoomLevel, compIndex, sep = "_") {
  return zoomLevel + sep + compIndex.toString();
}
export function linkKey(keyPrefix, downstream, upstream, otherSideRight) {
  return (
    keyPrefix +
    String(downstream).padStart(13, "0") +
    String(upstream).padStart(13, "0") +
    (otherSideRight ? "osr" : "osl")
  );
}

export function argsort(arr, sortFunc, threshold) {
  // Decorate-Sort-Undecorate argsort function
  // Modified version from
  // https://stackoverflow.com/questions/46622486/what-is-the-javascript-equivalent-of-numpy-argsort
  return arr
    .map((item, index) => [item, index])
    .sort(([arg1, ind1], [arg2, ind2]) =>
      sortFunc(arg1, ind1 < threshold, arg2, ind2 < threshold)
    )
    .map(([, item]) => item);
}

export function findEqualBins(arr) {
  let sameIdx = [];
  let numPairs = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < i; j++) {
      if (arr[i] === arr[j]) {
        sameIdx.push([i, j]);
        numPairs++;
      }
    }
  }

  let diffIdx = [];
  for (let i = 0; i < arr.len; i++) {
    if (!sameIdx.includes(i)) {
      diffIdx.push(i);
    }
  }
  return [sameIdx, diffIdx, numPairs];
}

export function determineAdjacentIntersection(curLink, prevLink, same) {
  let prevLinkLeft; // Is previous link adjacent side is on the left
  let curLinkLeft; // Is current link adjacent side is on the left

  let prevOtherSide;

  if (same.includes(0)) {
    // Previous link adjacent side is departure;
    prevOtherSide = prevLink.link.downstream;
    if (prevLink.invertedDeparture) {
      prevLinkLeft = true; // adjacent on the left
    } else {
      prevLinkLeft = false; // adjacent on the right
    }
  } else if (same.includes(1)) {
    // Previous link adjacent side is arrival;
    prevOtherSide = prevLink.link.upstream;
    if (prevLink.invertedArrival) {
      prevLinkLeft = false; // adjacent on the left
    } else {
      prevLinkLeft = true; // adjacent on the right
    }
  } else {
    // If none of prev link bins is not in adjacent pair,
    // then there is some weird loop and it should be marked as intersecting
    // Although, this is impossible situation but just in case. :-)
    return true;
  }

  let curOtherSide;
  if (same.includes(2)) {
    // Current link adjacent side is departure;
    curOtherSide = curLink.link.downstream;
    if (curLink.invertedDeparture) {
      curLinkLeft = true; // adjacent on the left
    } else {
      curLinkLeft = false; // adjacent on the right
    }
  } else if (same.includes(3)) {
    // Current link adjacent side is arrival;
    curOtherSide = curLink.link.upstream;
    if (curLink.invertedArrival) {
      curLinkLeft = false; // adjacent on the left
    } else {
      curLinkLeft = true; // adjacent on the right
    }
  } else {
    // If none of prev link bins is not in adjacent pair,
    // then there is some weird loop and it should be marked as intersecting
    // Although, this is impossible situation but just in case. :-)
    return true;
  }
  // XOR - if one is left and another is right
  // !! - convert to boolean
  if (!!(prevLinkLeft ^ curLinkLeft)) {
    if (
      (prevLinkLeft && curOtherSide < prevOtherSide) ||
      (curLinkLeft && curOtherSide > prevOtherSide)
    ) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }

  // Just in case I missed some unusual edge case,
  // it is better to consider arrows to intersect than not.
  return true;
}

export function binFromCol(comp, col) {
  let distRatio = (col - comp.firstCol) / (comp.lastCol - comp.firstCol);
  let bin =
    comp.firstBin + Math.round(distRatio * (comp.lastBin - comp.firstBin));

  return bin;
}

export function checkAndForceMinOrMaxValue(value, minValue, maxValue) {
  if (value < minValue) {
    value = minValue;
  } else if (value > maxValue) {
    value = maxValue;
  }

  return value;
}

// Short-circuiting, and saving a parse operation
export function isInt(value) {
  var x;
  if (isNaN(value)) {
    return false;
  }
  x = parseFloat(value);
  return (x | 0) === x;
}

function colourKeyCalc(from, to) {
  // return ((from+1)*(to+1)).toString(); // Current option
  return (
    from.toString().padStart(13, 0) +
    to.toString().padStart(13, 0) +
    ((from + 1) * (to + 1)).toString()
  );
}

export function stringToColorAndOpacity(
  linkColumn,
  highlightedLink,
  hiddenOpacity
) {
  const colorKey = colourKeyCalc(
    linkColumn.upstreamCol,
    linkColumn.downstreamCol
  );
  if (highlightedLink) {
    // When the mouse in on a Link, all the other ones will become gray and fade out
    let matchColor = colourKeyCalc(highlightedLink[0], highlightedLink[1]);
    // Check if the mouse in on a Link (highlightedLinkColumn) or if a Link was clicked (selectedLink)
    if (colorKey === matchColor) {
      return [
        stringToColourSave(colorKey),
        1.0,
        highlightedLink ? "black" : null,
      ];
    } else {
      return [stringToColourSave(colorKey), hiddenOpacity, null]; // used to be "gray"
    }
  } else {
    return [stringToColourSave(colorKey), 1.0, null];
  }
}

export function stringToColourSave(colorKey) {
  // colorKey = colorKey.toString();
  let hash = 0;
  for (let i = 0; i < colorKey.length; i++) {
    hash = colorKey.charCodeAt(i) + ((hash << 5) - hash);
  }
  // hash = hash & hash;
  let colour = "#";
  for (let j = 0; j < 3; j++) {
    const value = (hash >> (j * 8)) & 0xff;
    colour += ("00" + value.toString(16)).substr(-2);
  }
  return colour;
}
