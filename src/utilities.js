export const zip = (arr, ...arrs) => {
  /*Credit: https://gist.github.com/renaudtertrais/25fc5a2e64fe5d0e86894094c6989e10*/
  return arr.map((val, i) => arrs.reduce((a, arr) => [...a, arr[i]], [val]));
};

export function sum(a, b) {
  return a + b;
}

export function arraysEqual(A, B) {
  return (
    (A.length === 0 && B.length === 0) ||
    (A.length === B.length && A.every((e) => B.indexOf(e) > -1))
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
  // if (curLink.link.downstream===123 && prevLink.link.downstream===122) {
  //   debugger;
  // }
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

export function areOverlapping(startA, endA, startB, endB) {
  if (startB < startA) {
    return endB >= startA;
  } else if (startB > startA) {
    return startB <= endA;
  } else {
    return true;
  }
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

export function calculateEndBinFromScreen(
  beginBin,
  selZoomLev,
  store,
  widthInColumns
) {
  //console.log("calculateEndBinFromScreen: widthInColumns --> " + widthInColumns);

  let chunkURLarray = [];
  let fileArrayFasta = [];

  let firstFieldX = -1;

  const level = store.chunkIndex.zoom_levels.get(selZoomLev);
  //this loop will automatically cap out at the last bin of the file
  for (let ichunk = 0; ichunk < level.files.length; ichunk++) {
    // The "x" info is not here
    const chunk = level.files[ichunk];

    //if (areOverlapping(beginBin, endBin, chunk.first_bin, chunk.last_bin)){
    if (chunk.last_bin >= beginBin) {
      const fieldX = store.useWidthCompression ? chunk.compressedX : chunk.x;

      if (firstFieldX === -1) {
        firstFieldX = fieldX;
      }

      /*console.log("fieldX: " + fieldX);
      console.log('fieldX - firstFieldX: ' + (fieldX - firstFieldX))
      console.log("chunk.last_bin: " + chunk.last_bin);*/

      chunkURLarray.push(chunk["file"]);
      if (chunk.fasta !== null) {
        fileArrayFasta.push(chunk.fasta);
      }

      // If the new chunck is outside the windows, the chunk-pushing is over
      if (fieldX - firstFieldX >= widthInColumns) {
        break;
      }
    }
  }

  // store.updateBeginEndBin(b, b + widthInColumns);
  //TODO the logic in let width = could be much more complex by looking at
  //width of components and whether various settings are on.  The consequence
  //of overestimating widthInColumns is to make the shift buttons step too big
  return [chunkURLarray, fileArrayFasta];
}

export function range(start, end) {
  return [...Array(1 + end - start).keys()].map((v) => start + v);
}

export function stringToColorAndOpacity(linkColumn, highlightedLink) {
  const colorKey = (linkColumn.downstream + 1) * (linkColumn.upstream + 1);
  if (highlightedLink) {
    // When the mouse in on a Link, all the other ones will become gray and fade out
    let matchColor = (highlightedLink[0] + 1) * (highlightedLink[1] + 1);
    // Check if the mouse in on a Link (highlightedLinkColumn) or if a Link was clicked (selectedLink)
    if (colorKey === matchColor) {
      return [
        stringToColourSave(colorKey),
        1.0,
        highlightedLink ? "black" : null,
      ];
    } else {
      return ["gray", 0.3, null];
    }
  } else {
    return [stringToColourSave(colorKey), 1.0, null];
  }
}

export function stringToColourSave(colorKey) {
  colorKey = colorKey.toString();
  let hash = 0;
  for (let i = 0; i < colorKey.length; i++) {
    hash = colorKey.charCodeAt(i) + ((hash << 5) - hash);
  }
  let colour = "#";
  for (let j = 0; j < 3; j++) {
    const value = (hash >> (j * 8)) & 0xff;
    colour += ("00" + value.toString(16)).substr(-2);
  }
  return colour;
}

// From https://stackoverflow.com/questions/42623071/maximum-call-stack-size-exceeded-with-math-min-and-math-max/52613386#52613386
// Not-recursive implementation of Math.max to avoid 'RangeError: Maximum call stack size exceeded' for big arrays
export function getMax(arr) {
  let len = arr.length;
  let max = -Infinity;

  while (len--) {
    max = arr[len] > max ? arr[len] : max;
  }
  return max;
}
