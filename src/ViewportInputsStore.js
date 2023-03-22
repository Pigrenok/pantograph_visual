import { types, cast } from "mobx-state-tree";
import { entries, keys, values } from "mobx";
import { urlExists } from "./URL";
import {
  checkAndForceMinOrMaxValue,
  isInt,
  argsort,
  findEqualBins,
  determineAdjacentIntersection,
  linkKey,
  compKey,
  filter_sort_index_array,
} from "./utilities";

class JSONCache {
  // This class implements simple cache for requests to the server.

  constructor() {
    this.cacheAvailable = "caches" in window;

    if (this.cacheAvailable) {
      // caches.delete("jsonData");
      caches.open("jsonData").then((cache) => {
        this.cache = cache;
      });
    } else {
      this.cache = new Map();
    }
  }

  clear() {
    this.cache.keys().then((keys) => {
      for (const key of keys) {
        this.cache.delete(key);
      }
    });
  }

  _fetchJSON(url) {
    if (this.cacheAvailable) {
      if (urlExists(url)) {
        return this.cache.add(url).then(() => {
          return this.cache.match(url);
        });
      } else {
        window.alert(`URL ${url} does not exist`);
        console.error(`URL ${url} does not exist`);
        throw `URL ${url} does not exist`;
      }
    } else {
      let res = fetch(new Request(url))
        .then((response) => {
          response.json();
          this.cache.set(response.url, response);
          return response;
        })
        .catch((error) => {
          window.alert(
            `Fetch error: URL ${url} did not return expected format file (JSON) - ${error}`
          );
          console.error(
            `Fetch error: URL ${url} did not return expected format file (JSON) - ${error}`
          );
          throw `Fetch error: URL ${url} did not return expected format file (JSON) - ${error}`;
        });
      return res;
    }
  }

  _addData(url, data) {
    if (!(data instanceof Response)) {
      throw "Data is not Response object. It is not currently supported.";
    }

    if (this.cacheAvailable) {
      this.cache.put(url, data); // data should be Response. If json needs to be stores, do jsonData.stringify() before passing it here.
    } else {
      this.cache.set(url, data); // in this case, data can be anything, but for compatibility with the main Cache API,
      //the Response is still required.
    }
  }

  _addURL(url, data = null) {
    //data has to be either string or null or your `data` will be converted to string by `String(data)` method.`

    if (data !== null) {
      this._addData(url, data);
    } else {
      return this._fetchJSON(url);
    }
  }

  getRaw(url) {
    // Add case when cacheAvailable is false!
    let result = this.cache.match(url).then((response) => {
      if (response) {
        return response;
      } else {
        return this._addURL(url);
      }
    });

    return result;
  }

  getJSON(url) {
    return this.getRaw(url).then((response) => {
      return response.json();
    });
  }

  setJSON(url, jsonData) {
    let resp = new Response(JSON.stringify(jsonData), {
      status: 200,
      statusMessage: "OK",
    });
    Object.defineProperty(resp, "url", { value: "url" });
    this._addURL(url, resp);
  }
}

export let jsonCache = new JSONCache();

let promiseArray;

// Several MST models which overall implements component model
const BinData = types.model({
  repeats: types.number,
  reversal: types.number,
  pos: types.array(types.array(types.integer)),
});

const ComponentMatrixElement = types
  .model({
    pathID: types.identifierNumber,
    inverted: types.optional(types.boolean, false),
    occupiedBins: types.array(types.integer),
    binData: types.array(BinData),
  })
  .actions((self) => ({
    addBinData(binArray) {
      for (const bin of binArray) {
        self.binData.push({
          repeats: bin[0],
          reversal: bin[1],
          pos: bin[2],
        });
      }
    },
  }));

const LinkColumn = types
  .model({
    key: types.identifier,
    order: types.integer,
    upstream: types.integer,
    downstream: types.integer,
    upstreamCol: types.integer,
    downstreamCol: types.integer,
    otherSideRight: types.boolean,
    elevation: types.optional(types.integer, 0),
    participants: types.array(types.integer),
  })
  .views((self) => ({
    get distance() {
      return Math.abs(self.downstream - self.upstream);
    },
  }));

const Component = types
  .model({
    index: types.identifier,
    zoom_level: types.string,
    firstBin: types.integer,
    lastBin: types.integer,
    firstCol: types.integer,
    lastCol: types.integer,
    larrivals: types.map(LinkColumn),
    rarrivals: types.map(LinkColumn),
    ldepartures: types.map(LinkColumn),
    rdepartures: types.map(LinkColumn),
    relativePixelX: types.optional(types.integer, -1),
    departureVisible: types.optional(types.boolean, true),
    arrivalVisible: types.optional(types.boolean, true),
    occupants: types.array(types.integer),
    numBins: types.integer,
    matrix: types.map(ComponentMatrixElement),
    ends: types.array(types.integer),
    sequence: types.optional(types.string, ""),
    binsToCols: types.array(types.integer),
    binColStarts: types.array(types.integer),
    binColEnds: types.array(types.integer),
  })
  .actions((self) => ({
    updateEnds(ends) {
      self.ends = ends;
    },
    addMatrixElement(matrixElement) {
      let mel = ComponentMatrixElement.create({
        pathID: matrixElement[0],
        inverted: matrixElement[1] > 0,
        occupiedBins: matrixElement[2][0],
      });
      mel.addBinData(matrixElement[2][1]);
      self.matrix.set(mel.pathID, mel);
    },

    addMatrixElements(matrix) {
      for (const el of matrix) {
        self.addMatrixElement(el);
      }
    },

    addLeftLinks(departures, arrivals, debug) {
      if (debug) {
        debugger;
      }

      const arrThreshold = departures.length;

      let linkArray = departures.concat(arrivals);

      const sortFunc = (a, isad, b, isbd) => {
        // isad, isbd - if link a and link b (respectively) are departure links
        let ad;
        if (!isad) {
          ad = a.downstream - a.upstream;
        } else {
          ad = a.upstream - a.downstream;
        }

        let bd;
        if (!isbd) {
          bd = b.downstream - b.upstream;
        } else {
          bd = b.upstream - b.downstream;
        }
        if (ad * bd > 0) {
          return ad - bd;
        } else if (ad * bd < 0) {
          return bd - ad;
        } else if (ad * bd == 0) {
          if (ad == 0) {
            return Math.abs(bd);
          } else {
            return Math.abs(ad);
          }
        } else {
          if (ad === bd) {
            return 0;
          } else {
            return -1;
          }
        }
      };

      let sortedIds = argsort(linkArray, sortFunc, arrThreshold);

      let i = 0;
      for (const id of sortedIds) {
        let keyPrefix;
        let mapToUse;
        let link;
        if (id < arrThreshold) {
          keyPrefix = "d";
          mapToUse = self.ldepartures;
          link = departures[id];
        } else {
          keyPrefix = "a";
          mapToUse = self.larrivals;
          link = arrivals[id - arrThreshold];
        }

        let linkCol = LinkColumn.create({
          key: linkKey(
            keyPrefix,
            link.downstream,
            link.upstream,
            link.otherSideRight
          ),
          order: i,
          ...link,
        });
        mapToUse.set(linkCol.key, linkCol);
        i++;
      }
    },

    addRightLinks(departures, arrivals, debug) {
      if (debug) {
        debugger;
      }

      const arrThreshold = departures.length;

      let linkArray = departures.concat(arrivals);

      const sortFunc = (a, isad, b, isbd) => {
        let ad;
        if (isad) {
          ad = a.downstream - a.upstream;
        } else {
          ad = a.upstream - a.downstream;
        }

        let bd;
        if (isbd) {
          bd = b.downstream - b.upstream;
        } else {
          bd = b.upstream - b.downstream;
        }
        if (ad * bd > 0) {
          return bd - ad;
        } else if (ad * bd < 0) {
          return ad - bd;
        } else if (ad * bd == 0) {
          if (ad == 0) {
            return -1 * Math.abs(bd);
          } else {
            return -1 * Math.abs(ad);
          }
        } else {
          if (ad === bd) {
            return 0;
          } else {
            return -1;
          }
        }
      };

      let sortedIds = argsort(linkArray, sortFunc, arrThreshold);

      let i = 0;
      for (const id of sortedIds) {
        let keyPrefix;
        let mapToUse;
        let link;
        let order;
        if (id < arrThreshold) {
          keyPrefix = "d";
          mapToUse = self.rdepartures;
          link = departures[id];
          if (link.upstream + 1 != link.downstream || link.otherSideRight) {
            order = i;
            i++;
          } else {
            order = -1;
          }
        } else {
          keyPrefix = "a";
          mapToUse = self.rarrivals;
          link = arrivals[id - arrThreshold];
          if (link.upstream - 1 != link.downstream || link.otherSideRight) {
            order = i;
            i++;
          } else {
            order = -1;
          }
        }

        let linkCol = LinkColumn.create({
          key:
            keyPrefix +
            String(link.downstream).padStart(13, "0") +
            String(link.upstream).padStart(13, "0") +
            (link.otherSideRight ? "osr" : "osl"),
          order: order,
          ...link,
        });
        mapToUse.set(linkCol.key, linkCol);
      }
    },

    moveTo(newRelativePixelX, windowWidth, pixelsPerColumn, arrivalVis = true) {
      self.relativePixelX = newRelativePixelX;
      self.departureVisible = true;
      if (windowWidth && pixelsPerColumn) {
        if (
          windowWidth <
          self.relativePixelX +
            (self.leftLinkSize + self.numBins + self.rightLinkSize) *
              pixelsPerColumn
        ) {
          self.departureVisible = false;
        }

        self.arrivalVisible = arrivalVis;
        if (self.relativePixelX < 0) {
          self.arrivalVisible = false;
          self.relativePixelX += self.leftLinkSize * pixelsPerColumn;
        }
      }
    },
  }))
  .views((self) => ({
    get leftLinkSize() {
      return self.ldepartures.size + self.larrivals.size;
    },

    get rightLinkSize() {
      return self.farRightDepartures.size + self.farRightArrivals.size;

      // Calculate all far links on the right + 1 for connector column
    },

    get farRightDepartures() {
      let links = new Map();
      for (let linkColumn of values(self.rdepartures)) {
        if (
          linkColumn.upstream + 1 != linkColumn.downstream ||
          linkColumn.otherSideRight
        ) {
          links.set(linkColumn.key, linkColumn);
        }
      }

      return links;
    },

    get farRightArrivals() {
      let links = new Map();
      for (let linkColumn of values(self.rarrivals)) {
        if (
          linkColumn.downstream + 1 != linkColumn.upstream ||
          linkColumn.otherSideRight
        ) {
          links.set(linkColumn.key, linkColumn);
        }
      }

      return links;
    },

    get connectorDepartures() {
      for (let linkColumn of values(self.rdepartures)) {
        if (
          linkColumn.upstream + 1 === linkColumn.downstream &&
          !linkColumn.otherSideRight
        ) {
          return linkColumn;
        }
      }

      return null;
    },

    get connectorArrivals() {
      for (let linkColumn of values(self.rarrivals)) {
        if (
          linkColumn.downstream + 1 === linkColumn.upstream &&
          !linkColumn.otherSideRight
        ) {
          return linkColumn;
        }
      }

      return null;
    },

    // when we will get across information about order of passes
    // through the node in relation to links, its sorting needs
    // to be included here
  }));
// End of component model

// The following three MST models implement index for the whole graph visualisation data
const Chunk = types.model({
  file: types.string,
  fasta: types.maybeNull(types.string),
  first_bin: types.integer,
  first_col: types.integer,
  last_bin: types.integer,
  last_col: types.integer,
  compVisCol: types.map(types.integer),
  chunkVisCol: types.integer,
});
const ZoomLevel = types.model({
  last_bin: types.integer,
  last_col: types.integer,
  files: types.array(Chunk),
});
const ChunkIndex = types.model({
  json_version: types.integer,
  pangenome_length: types.integer,
  pathNames: types.array(types.string),
  zoom_levels: types.map(ZoomLevel),
});
// End of graph visualisation index model.

const searchTermsStruct = types.model({
  path: types.string,
  searchType: types.integer,
  search: types.string,
});

const cellHighlightClass = types.model({
  bin: types.integer,
  accession: types.integer,
});

let RootStore;
RootStore = types
  .model({
    chunkIndex: types.maybeNull(ChunkIndex),
    position: types.optional(types.integer, 1),
    editingPosition: types.optional(types.integer, 1),
    breakComponentUpdate: false,

    beginBinVisual: types.optional(types.integer, 1),
    endBinVisual: types.optional(types.integer, 1),

    pixelsPerColumn: 10,
    pixelsPerRow: 10,
    editingPixelsPerColumn: types.optional(types.integer, 10),

    heightNavigationBar: 25,
    leftOffset: 1,
    maxArrowHeight: types.optional(types.integer, 0),
    highlightedLink: types.maybeNull(types.array(types.integer)), // we will compare linkColumns
    highlightedAccession: types.maybeNull(types.integer),
    cellToolTipContent: "",

    projects: types.map(types.string),
    selectedProject: types.maybeNull(types.string),
    projectCases: types.map(types.string),
    selectedProjectCase: types.maybeNull(types.string),

    indexSelectedZoomLevel: 0,

    searchTerms: types.optional(searchTermsStruct, {
      path: "",
      searchType: 0,
      search: "",
    }),
    pathIndexServerAddress: process.env.REACT_APP_API_SERVER,

    loading: false,
    chunkLoading: true,
    copyNumberColorArray: types.optional(types.array(types.string), [
      "#C0C0C0",
      "#707070",
      "#606060",
      "#505050",
      "#404040",
      "#303030",
      "#202020",
      "#151515",
      "#101010",
      "#000000",
    ]),
    invertedColorArray: types.optional(types.array(types.string), [
      "#ff9999",
      "#ff0000",
      "#cc0000",
      "#aa0000",
      "#880000",
      "#660000",
      "#440000",
      "#220000",
      "#110000",
      "#000000",
    ]),
    hiddenElementOpacity: 0.1,
    selectedComponents: types.optional(
      types.array(types.array(types.integer)),
      []
    ),
    filterPaths: types.optional(types.array(types.integer), []),
    filterMainAccession: types.maybeNull(types.integer),
    zoomHighlightBoundaries: types.array(types.integer),
    zoomHighlightBoundariesCoord: types.array(types.integer),
    highlightedCell: types.maybeNull(cellHighlightClass),
    components: types.map(Component),
    visualisedComponents: types.map(
      types.reference(types.late(() => Component))
    ),
    leftCompInvisible: types.safeReference(types.late(() => Component)),
    windowWidth: types.optional(types.integer, 0),
    mouseX: types.optional(types.integer, 0),
    mouseY: types.optional(types.integer, 0),
    updatingVisible: true,
    hideInversionLinks: true,
    doHighlightRows: false,
    preferHighlight: false,
    colourRepeats: true,
  })
  .actions((self) => ({
    setLeftCompInvisible(comp) {
      if (comp !== undefined) {
        self.leftCompInvisible = comp.index;
      }
    },

    changeFilterPathsArray(checked, pathID) {
      if (checked) {
        self.filterPaths.push(parseInt(pathID));
        self.filterPaths.replace(
          self.filterPaths.slice().sort((a, b) => a - b)
        );
      } else {
        let iPathID = parseInt(pathID);
        self.filterPaths.replace(
          self.filterPaths
            .filter((a) => a !== iPathID)
            .slice()
            .sort((a, b) => a - b)
        );
        if (iPathID == self.filterMainAccession) {
          self.filterMainAccession = null;
        }
      }

      if (self.filterPaths.length > 0) {
        self.preferHighlight = false;
      }
    },

    clearFilterPathsArray() {
      self.filterPaths.replace([]);
    },

    changeFilterMainPath(value) {
      let iValue = parseInt(value);
      if (iValue === -1) {
        self.filterMainAccession = null;
      } else {
        self.filterMainAccession = iValue;
      }
    },

    toggleColourRepeats() {
      self.colourRepeats = !self.colourRepeats;
    },

    highlightCell(bin, accession) {
      self.highlightedCell = cellHighlightClass.create({
        bin: bin,
        accession: accession,
      });
    },

    clearHighlightCell() {
      self.highlightedCell = null;
    },

    toggleDoHighlightRows() {
      if (self.doHighlightRows && self.preferHighlight) {
        self.togglePreferHighlight();
      }
      self.doHighlightRows = !self.doHighlightRows;
    },

    togglePreferHighlight() {
      if (self.filterPaths.length === 0) {
        self.preferHighlight = !self.preferHighlight;
      } else {
        self.preferHighlight = false;
      }
    },

    setHighlightedAccession(accessionNumber) {
      if (accessionNumber < self.chunkIndex.pathNames.length) {
        self.highlightedAccession = accessionNumber;
      } else {
        self.highlightedLink = null;
      }
    },

    clearHighlightedAccession() {
      self.highlightedAccession = null;
    },

    toggleHideInversionLinks() {
      self.hideInversionLinks = !self.hideInversionLinks;
    },

    updateMouse(x, y) {
      self.mouseX = x;
      self.mouseY = y;
    },

    updateWindow(windowWidth) {
      // Called when the window size changes to recalculate the view.
      self.windowWidth = windowWidth;
      self.updatePosition(self.getPosition);
    },

    addComponent(component, seq) {
      // Add loaded component to the store.

      // Component index by first zoom
      let curComp = Component.create({
        index: compKey(self.selectedZoomLevel, component.first_bin),
        zoom_level: self.selectedZoomLevel,
        firstBin: component.first_bin,
        lastBin: component.last_bin,

        firstCol: component.firstCol,
        lastCol: component.lastCol,

        relativePixelX: -1,

        // deep copy of occupants
        occupants: component.occupants,
        numBins: component.last_bin - component.first_bin + 1,
        sequence: seq,
        binsToCols: component.binsToCols,
        binColStarts: component.binColStarts,
        binColEnds: component.binColEnds,
      });
      curComp.updateEnds(component.ends);
      curComp.addMatrixElements(component.matrix);
      let dbg = false;

      curComp.addLeftLinks(component.ldepartures, component.larrivals, dbg);
      curComp.addRightLinks(component.rdepartures, component.rarrivals, dbg);
      self.components.set(curComp.index, curComp);
    },

    addComponents(compArray, nucleotides = [], fromRight = true) {
      // Add chunk with multiple components to the store.
      let splicing = 0;

      if (compArray[0].first_bin === 0) {
        splicing = 1;
      }
      let offset = compArray[splicing].first_bin;

      if (!fromRight) {
        compArray.reverse();
      }
      let compBins = [];
      compArray.forEach((comp) => {
        compBins.push([comp.first_bin, comp.last_bin]);
      });

      for (const component of compArray.splice(splicing)) {
        // If new update is needed, current update should be interrupted.
        if (self.breakComponentUpdate) {
          break;
        }

        if (
          !self.components.has(
            compKey(self.selectedZoomLevel, component.first_bin)
          )
        ) {
          let seq = "";
          if (nucleotides.length > 0) {
            seq = nucleotides.slice(
              component.first_bin - offset,
              component.last_bin - offset + 1
            );
          }
          self.addComponent(component, seq);
        }
      }
    },

    addComponentsFromURL(url, fastaURL, fromRight = true) {
      // Download chunk file and add all components to the store.
      if (self.breakComponentUpdate) {
        return;
      }
      return jsonCache
        .getJSON(
          `${process.env.PUBLIC_URL}/data/${self.selectedProject}/${self.selectedProjectCase}/${self.selectedZoomLevel}/${url}`
        )
        .then((data) => {
          if (fastaURL === null) {
            return Promise.resolve([data.components, [], fromRight]);
          } else {
            return self
              .addNucleotidesFromFasta(
                `${process.env.PUBLIC_URL}/data/${self.selectedProject}/${self.selectedProjectCase}/${self.selectedZoomLevel}/${fastaURL}`
              )
              .then((sequence) => {
                return Promise.resolve([data.components, sequence, fromRight]);
              });
          }
        })
        .then((res) => {
          self.addComponents(...res);
        });
    },

    addNucleotidesFromFasta(url) {
      // Download special fasta file related to specific chunk file to add nucleotides to components.
      return jsonCache
        .getRaw(url)
        .then((data) => data.text())
        .then((data) => {
          let sequence = data
            .replace(/.*/, "")
            .substr(1)
            .replace(/[\r\n]+/gm, "");

          return sequence;
        })
        .catch((err) => {
          console.debug("Cannot load nucleotides: ", err);
        });
    },

    shiftComponentsRight(
      windowStart,
      numColsToFill,
      byCols = false,
      doClean = true
    ) {
      // This function loads components from windowStart to the right
      // to fill numColsToFill columns in the view.
      // If there are components to the right from last loaded bin,
      // they will be removed if doClean is `true`.
      // If byCols is `true`, the windowStart is considered to be cols (bottom level bins), otherwise it is in current level bins.

      if (self.breakComponentUpdate) {
        return [[], 0];
      }
      self.setLoading(true);

      let firstLoadedBin;
      let lastLoadedBin;

      if (self.components.size > 0) {
        firstLoadedBin = self.firstLoadedBin;
        lastLoadedBin = self.lastLoadedBin;
      } else {
        firstLoadedBin = self.last_bin_pangenome;
        lastLoadedBin = 0;
      }

      let chunkArray = self.chunkIndex.zoom_levels
        .get(self.selectedZoomLevel)
        .files.slice();

      let startChunkIndex;

      if (byCols) {
        startChunkIndex = chunkArray.findIndex(
          (chunk) => chunk.first_col > windowStart
        );
      } else {
        startChunkIndex = chunkArray.findIndex(
          (chunk) => chunk.first_bin > windowStart
        );
      }

      startChunkIndex -= 1;

      let promiseArray = [];
      let loadedCols = 0;
      let startCounting = false;
      let newLoadedEndBin = lastLoadedBin;

      for (let chunkFile of chunkArray.slice(startChunkIndex)) {
        if (
          (chunkFile.first_bin < firstLoadedBin ||
            chunkFile.last_bin > lastLoadedBin) &&
          loadedCols <= numColsToFill
        ) {
          promiseArray.push(
            self.addComponentsFromURL(chunkFile.file, chunkFile.fasta, true)
          );
          if (startCounting) {
            loadedCols += chunkFile.chunkVisCol;
          } else {
            startCounting = true;
          }
          newLoadedEndBin = chunkFile.last_bin;
        }
      }

      if (doClean && self.components.size > 0) {
        self.removeComponents(newLoadedEndBin + 1, false);
      }

      return [promiseArray, newLoadedEndBin];
    },

    shiftComponentsLeft(
      windowEnd,
      numColsToFill,
      byCols = false,
      doClean = true
    ) {
      // This function loads components from windowEnd to the left
      // to fill numColsToFill columns in the view.
      // If there are components to the left from loaded components,
      // they will remove them if doClean is `true`.
      // If byCols is `true`, the windowEnd is considered to be cols (bottom level bins), otherwise it is in current level bins.

      if (self.breakComponentUpdate) {
        return [[], 0];
      }

      self.setLoading(true);

      let firstLoadedBin;
      let lastLoadedBin;

      if (self.components.size > 0) {
        firstLoadedBin = self.firstLoadedBin;
        lastLoadedBin = self.lastLoadedBin;
      } else {
        firstLoadedBin = self.last_bin_pangenome;
        lastLoadedBin = 0;
      }

      let reversedChunkArray = self.chunkIndex.zoom_levels
        .get(self.selectedZoomLevel)
        .files.slice()
        .reverse();

      let endChunkIndex;

      if (byCols) {
        endChunkIndex = reversedChunkArray.findIndex(
          (chunk) => chunk.first_col <= windowEnd
        );
      } else {
        endChunkIndex = reversedChunkArray.findIndex(
          (chunk) => chunk.first_bin <= windowEnd
        );
      }

      let promiseArray = [];

      let loadedCols = 0;
      let startCounting = false;
      let newLoadedStartBin = firstLoadedBin;

      for (let chunkFile of reversedChunkArray.slice(endChunkIndex)) {
        if (
          (chunkFile.first_bin < firstLoadedBin ||
            chunkFile.last_bin > lastLoadedBin) &&
          loadedCols <= numColsToFill
        ) {
          promiseArray.push(
            self.addComponentsFromURL(chunkFile.file, chunkFile.fasta, false)
          );

          if (startCounting) {
            loadedCols += chunkFile.chunkVisCol;
          } else {
            startCounting = true;
          }
          newLoadedStartBin = chunkFile.first_bin;
        }
      }

      if (doClean && self.components.size > 0) {
        self.removeComponents(newLoadedStartBin - 1, true);
      }

      return [promiseArray, newLoadedStartBin];
    },

    removeComponent(id) {
      self.visualisedComponents.delete(id);
      self.components.delete(id);
    },

    removeComponents(lastStop, fromBeginning) {
      // Remove all components from store either from the most left to `lastStop` (if `fromBeginning` is true)
      // or from lastStop to the right edge (if `fromBeginning` is false)
      for (let index of self.sortedComponentsKeys) {
        let comp = self.components.get(index);
        if (fromBeginning) {
          if (comp.lastBin < lastStop) {
            self.removeComponent(comp.index);
          } else {
            break;
          }
        } else {
          if (comp.firstBin > lastStop) {
            self.removeComponent(comp.index);
          }
        }
      }
    },

    clearComponents() {
      // Clear all components from the store.

      if (self.visualisedComponents.length > 0) {
        self.visualisedComponents.clear();
      }

      self.breakComponentUpdate = true;

      if (self.loading) {
        setTimeout(() => {
          self.clearComponents();
        }, 100);
      } else {
        self.breakComponentUpdate = false;
        self.updatingVisible = true;
        self.setLoading(true);
        self.nucleotides = [];
        self.components.clear();
      }
    },

    clearOldZoomLevelComponents(sep = "_") {
      // When the app jumps from one zoom level to the other, it first load components for the next zoom level, then update what is visible (to new components)
      // and then remove components remaining from previous zoom level. That last step is done by this function.
      return new Promise((resolve, reject) => {
        resolve();
      }).then(() => {
        for (let key of keys(self.components)) {
          if (key.split(sep)[0] != self.selectedZoomLevel) {
            self.removeComponent(key);
          }
        }
      });
    },

    setZoomHighlightBoundaries(startBin, endBin) {
      self.zoomHighlightBoundariesCoord = [];
      self.zoomHighlightBoundaries = [startBin, endBin];
    },

    clearZoomHighlightBoundaries() {
      self.zoomHighlightBoundariesCoord = [];
      self.zoomHighlightBoundaries = [];
    },

    addZoomHighlightBoundCoord(xPos) {
      self.zoomHighlightBoundariesCoord.push(xPos);
    },

    // The following block of functions loads project and cases for each project from data index, project indexes.
    loadProjects(selectedProject = null, selectedCase = null) {
      self.setChunkLoading();

      let url = process.env.PUBLIC_URL + "/data/" + "index.json";

      if (!urlExists(url)) {
        window.alert(
          `Data index index.json at ${url} was not found. Without it, Pantograph will not work.`
        );
        console.error(
          `Data index index.json at ${url} was not found. Without it, Pantograph will not work.`
        );
        return;
      }

      return fetch(url)
        .then((res) => res.json())
        .then((json) => {
          console.log("Loading projects", url);

          return self.setProjectsMap(
            json.projects,
            selectedProject,
            selectedCase
          );
        });
    },

    setProjectsMap(projects, selectedProject = null, selectedCase = null) {
      self.projects = cast(projects);
      if (selectedProject !== null && self.projects.has(selectedProject)) {
        return self.setSelectedProject(selectedProject, selectedCase);
      } else if (
        self.selectedProject === null ||
        !self.projects.has(self.selectedProject)
      ) {
        return self.setSelectedProject(
          self.projects.keys().next().value,
          selectedCase
        );
      } else {
        return self.loadCases(selectedCase);
      }
    },

    setSelectedProject(selectedProject, selectedCase = null) {
      if (self.projects.has(selectedProject)) {
        self.selectedProject = selectedProject;
        return self.loadCases(selectedCase);
      }
    },

    loadCases(selectedCase = null) {
      let url =
        process.env.PUBLIC_URL +
        "/data/" +
        self.selectedProject +
        "/" +
        self.selectedProject +
        "_project.json";

      if (!urlExists(url)) {
        window.alert(
          `Project index file ${self.selectedProject}_project.json at ${url} was not found. Without it, the project cannot be loaded.`
        );
        console.error(
          `Project index file ${self.selectedProject}_project.json at ${url} was not found. Without it, the project cannot be loaded.`
        );
        return;
      }

      return fetch(url)
        .then((res) => res.json())
        .then((json) => {
          console.log("Loading cases for project", self.selectedProject);

          return self.setCasesMap(json, selectedCase);
        });
    },

    setCasesMap(cases, selectedCase = null) {
      self.projectCases = cast(cases);
      if (selectedCase !== null && self.projectCases.has(selectedCase)) {
        return self.setSelectedProjectCase(selectedCase);
      } else if (
        self.selectedProjectCase === null ||
        !self.projectCases.has(self.selectedProjectCase)
      ) {
        return self.setSelectedProjectCase(
          self.projectCases.keys().next().value
        );
      } else {
        return self.loadIndexFile();
      }
    },

    setSelectedProjectCase(selectedCase) {
      if (self.projectCases.has(selectedCase)) {
        self.selectedProjectCase = selectedCase;
        return self.loadIndexFile();
      }
    },
    // End of block for loading project and their cases.

    loadIndexFile(zoomIndex = 0) {
      // Loading main case data file with index of zoom levels and chunk files.
      self.setChunkLoading();

      if (self.components.size > 0) {
        self.clearVisualisedComponents();
        self.clearComponents();
      }
      self.setLoading(false);

      let indexPath =
        process.env.PUBLIC_URL +
        "/data/" +
        self.selectedProject +
        "/" +
        self.selectedProjectCase +
        "/" +
        "bin2file.json";

      if (!urlExists(indexPath)) {
        window.alert(`Case index file bin2file.json for case ${self.selectedProjectCase} of project ${self.selectedProject} at ${indexPath} was not found. 
          Without it, the project cannot be loaded.`);
        console.error(`Case index file bin2file.json for case ${self.selectedProjectCase} of project ${self.selectedProject} at ${indexPath} was not found. 
          Without it, the project cannot be loaded.`);
        return;
      }

      return fetch(indexPath)
        .then((res) => res.json())
        .then((json) => {
          self.setChunkIndex(json, zoomIndex);
          self.unsetChunkLoading();
        });
    },

    setChunkIndex(json, zoomIndex = 0) {
      self.indexSelectedZoomLevel = zoomIndex;
      self.chunkIndex = null; // Needed to clear out the reference. Otherwise previos and new chunks can potentially mix.

      self.chunkIndex = { ...json };
    },

    clearVisualisedComponents() {
      // Clearing the list of components that should be rendered.
      self.updatingVisible = true;
      for (let key of keys(self.visualisedComponents)) {
        if (self.components.has(key)) {
          self.components.get(key).moveTo(-1);
        }
      }
      self.visualisedComponents.clear();
    },

    calcLinkElevations() {
      // This function calculates heights of each visible link in order to make them as readable as possible.

      let visibleLinks = [];

      for (let comp of values(self.visualisedComponents)) {
        let compZoomLevel = comp.zoom_level;
        if (comp.lastBin <= self.getEndBin && comp.departureVisible) {
          for (let link of values(comp.rdepartures)) {
            let dComp = self.linkInView(link.downstream, compZoomLevel);
            let invertedArrival = link.key.slice(link.key.length - 3) === "osr";
            if (
              dComp &&
              (link.upstream + 1 != link.downstream || invertedArrival)
            ) {
              visibleLinks.push({
                compIndex: comp.index,
                link: link,
                wideComp: comp.numBins > 1,
                invertedDeparture: false,
                invertedArrival,
              });
              link.elevation = 0;
            }
          }
        }

        if (comp.firstBin >= self.getBeginBin) {
          for (let link of values(comp.ldepartures)) {
            let dComp = self.linkInView(link.downstream, compZoomLevel);
            let invertedArrival = link.key.slice(link.key.length - 3) === "osr";
            if (dComp) {
              visibleLinks.push({
                compIndex: comp.index,
                link: link,
                wideComp: comp.numBins > 1,
                invertedDeparture: true,
                invertedArrival,
              });
              link.elevation = 0;
            }
          }
        }
      }

      visibleLinks.sort((a, b) => {
        return a.link.distance - b.link.distance;
      });

      const isIntersecting = (curLinkIdx, prevLinkIdx) => {
        let curLink = visibleLinks[curLinkIdx];
        let prevLink = visibleLinks[prevLinkIdx];

        let curStart = Math.min(curLink.link.upstream, curLink.link.downstream);

        let curEnd = Math.max(curLink.link.upstream, curLink.link.downstream);

        let prevStart = Math.min(
          prevLink.link.upstream,
          prevLink.link.downstream
        );

        let prevEnd = Math.max(
          prevLink.link.upstream,
          prevLink.link.downstream
        );

        let intersection = (curEnd - prevStart) * (prevEnd - curStart) > 0;
        let nonintersection = (curEnd - prevStart) * (prevEnd - curStart) < 0;

        if (intersection) {
          return true;
        } else if (nonintersection) {
          return false;
        }

        if (!curLink.wideComp || !prevLink.wideComp) {
          let [equalIdx, diffIdx, numPairs] = findEqualBins([
            prevLink.link.upstream,
            prevLink.link.downstream,
            curLink.link.upstream,
            curLink.link.downstream,
          ]);
          if (numPairs > 1) {
            return true;
          }

          return determineAdjacentIntersection(curLink, prevLink, equalIdx[0]);
          // analysis of intersection on at least one single bin component.
        } else {
          return false;
        }
      };

      self.maxArrowHeight = 0;
      for (let curLinkIdx = 1; curLinkIdx < visibleLinks.length; curLinkIdx++) {
        let existingElevations = new Set();
        for (let prevLinkIdx = 0; prevLinkIdx < curLinkIdx; prevLinkIdx++) {
          if (isIntersecting(curLinkIdx, prevLinkIdx)) {
            existingElevations.add(visibleLinks[prevLinkIdx].link.elevation);
          }
        }
        existingElevations = Array.from(existingElevations).sort(
          (a, b) => a - b
        );
        let foundElevation = false;
        for (let i = 0; i < existingElevations.length; i++) {
          if (i < existingElevations[i]) {
            visibleLinks[curLinkIdx].link.elevation = i;
            foundElevation = true;
            break;
          }
        }
        if (!foundElevation) {
          visibleLinks[curLinkIdx].link.elevation = existingElevations.length;
        }
        // Go through exisitingElevations and find the first case where
        // index is not equal value (set should be converted to array and sorted)

        if (self.maxArrowHeight < visibleLinks[curLinkIdx].link.elevation) {
          self.maxArrowHeight = visibleLinks[curLinkIdx].link.elevation;
        }
      }
    },

    shiftVisualisedComponentsCentre(
      centreBin,
      centreCol = false,
      highlight = false
    ) {
      // Load and unload components to the list of components that should be rendered. It takes central position either in column number in the current
      // zoom level or nucleotide number (base zoom level coordinate system) and place this column in the centre of the view. After that it fills
      //available space to the left and right

      let visComps = [];
      self.maxArrowHeight = 0;

      let begin = centreBin;
      let end = centreBin;

      let sortedKeys = self.sortedComponentsKeys;

      let centreCompIndex = sortedKeys.length - 1;

      if (centreCol) {
        for (let i = 0; i < sortedKeys.length; i++) {
          let tComp = self.components.get(sortedKeys[i]);
          if (tComp.firstCol <= centreBin && tComp.lastCol >= centreBin) {
            centreCompIndex = i;

            for (let bin = 0; bin < tComp.numBins; bin++) {
              if (
                tComp.binColStarts[bin] <= centreBin &&
                tComp.binColEnds[bin] >= centreBin
              ) {
                centreBin = tComp.firstBin + bin;
                break;
              }
            }

            break;
          }
        }
      } else {
        for (let i = 0; i < sortedKeys.length; i++) {
          if (parseInt(sortedKeys[i].split("_")[1]) > centreBin) {
            centreCompIndex = i - 1;
            break;
          }
        }
      }

      self.setPosition(centreBin);
      // Preparation ends
      let curComp = self.components.get(sortedKeys[centreCompIndex]);

      let leftSpaceInCols =
        curComp.leftLinkSize + (centreBin - curComp.firstBin + 1);
      let rightSpaceInCols =
        curComp.rightLinkSize + (curComp.lastBin - centreBin);

      visComps.push(curComp.index);

      let counter = 1;

      while (
        leftSpaceInCols < self.leftHalfCols &&
        centreCompIndex - counter >= 0
      ) {
        curComp = self.components.get(sortedKeys[centreCompIndex - counter]);

        if (leftSpaceInCols + curComp.rightLinkSize < self.leftHalfCols) {
          leftSpaceInCols +=
            curComp.leftLinkSize + curComp.numBins + curComp.rightLinkSize;

          visComps.splice(0, 0, curComp.index);
        } else {
          curComp = self.components.get(
            sortedKeys[centreCompIndex - counter + 1]
          );
          break;
        }

        counter++;
      }

      let relativePos =
        self.centreBinEndPos - leftSpaceInCols * self.pixelsPerColumn;

      let arrivalVisible = true;

      if (leftSpaceInCols < self.leftHalfCols) {
        begin = curComp.firstBin;
      } else if (leftSpaceInCols > self.leftHalfCols) {
        let beginAdj = Math.max(
          0,
          Math.ceil(leftSpaceInCols - self.leftHalfCols - curComp.leftLinkSize)
        );
        begin = curComp.firstBin + beginAdj;
        relativePos += beginAdj * self.pixelsPerColumn;
        arrivalVisible = false;
      } else {
        begin = curComp.firstBin;
      }

      if (leftSpaceInCols > self.leftHalfCols) {
        leftSpaceInCols = self.leftHalfCols;
      }

      counter = 1;

      let rightFilled = false;

      while (
        rightSpaceInCols < self.rightHalfCols &&
        centreCompIndex + counter < sortedKeys.length
      ) {
        rightFilled = true;
        curComp = self.components.get(sortedKeys[centreCompIndex + counter]);

        if (rightSpaceInCols + curComp.leftLinkSize < self.rightHalfCols) {
          rightSpaceInCols +=
            curComp.leftLinkSize + curComp.numBins + curComp.rightLinkSize;

          visComps.push(curComp.index);
        } else {
          curComp = self.components.get(
            sortedKeys[centreCompIndex + counter - 1]
          );
          break;
        }

        counter++;
      }

      if (!rightFilled) {
        curComp = self.components.get(sortedKeys[centreCompIndex]);
      }

      if (rightSpaceInCols < self.rightHalfCols) {
        end = curComp.lastBin;
      } else {
        if (rightSpaceInCols - curComp.rightLinkSize < self.rightHalfCols) {
          end = curComp.lastBin;
        } else {
          end =
            curComp.lastBin -
            Math.max(
              0,
              Math.ceil(
                rightSpaceInCols - curComp.rightLinkSize - self.rightHalfCols
              )
            );
        }
      }

      keys(self.visualisedComponents).forEach((compId) => {
        let comp = self.visualisedComponents.get(compId);
        if (
          compId.split("_")[0] !== self.selectedZoomLevel ||
          comp.lastBin < begin ||
          comp.firstBin > end
        ) {
          self.visualisedComponents.delete(compId);
        }
      });
      // Removing old references

      visComps.forEach((item, index) => {
        let curComp = self.components.get(item);
        curComp.moveTo(
          relativePos,
          self.windowWidth,
          self.pixelsPerColumn,
          index == 0 ? arrivalVisible : true
        );

        let leftSize = curComp.leftLinkSize;
        let bodySize = curComp.numBins;

        if (!curComp.arrivalVisible) {
          relativePos = curComp.relativePixelX;
          leftSize = 0;
          bodySize = curComp.lastBin - begin + 1;
        }

        relativePos +=
          (leftSize + bodySize + curComp.rightLinkSize) * self.pixelsPerColumn;

        self.visualisedComponents.set(item, item);
      });
      // Adding new components to visualised components

      self.setLeftCompInvisible(self.compByBin(self.firstVisualBin - 1));

      self.setBeginBinVisual(begin);
      self.setEndBinVisual(end);
      self.calcLinkElevations();

      self.updatingVisible = false;
    },

    setBeginBinVisual(begin) {
      self.beginBinVisual = begin;
    },

    setEndBinVisual(end) {
      self.endBinVisual = end;
    },

    mainUpdate(newPos, leftLoaded, rightLoaded, byCol = false, clean = true) {
      // Initially, when the view is changed (moving of centre position, switching between zoom levels, cases or projects), the system loads minimum
      // number of components to render full view as soon as possible.
      // After that with low priority more components to the left from left edge and tot he right from right edge are loaded by this function
      // to be able to move short distance left and right quicker.
      if (leftLoaded !== -1) {
        self.removeComponents(leftLoaded, true);
      }

      if (rightLoaded !== -1) {
        self.removeComponents(rightLoaded, false);
      }

      let promiseArray = [];

      let pa = self.shiftComponentsLeft(
        newPos,
        2 * self.columnsInView,
        byCol,
        clean
      );

      promiseArray = promiseArray.concat(pa[0]);

      pa = self.shiftComponentsRight(
        newPos,
        2 * self.columnsInView,
        byCol,
        clean
      );

      promiseArray = promiseArray.concat(pa[0]);

      Promise.all(promiseArray).then(() => {
        console.debug("Main update finished.");
        self.setLoading(false);
      });
    },

    updatePosition(
      newPos,
      highlight = false,
      byCol = false,
      zoomHighlight = [],
      zoom = false
    ) {
      // Changing central position of the view (can be basicmoving of centre position, switching between zoom levels, cases or projects).
      // This function takes care of the main orchestration of all changes required.

      self.breakComponentUpdate = true;

      if (self.loading) {
        setTimeout(() => {
          self.updatePosition(newPos, highlight, byCol);
        }, 100);
      } else {
        self.breakComponentUpdate = false;

        self.updatingVisible = true;
        self.updateHighlightedLink(null);

        let promiseArray = [];

        // Sometimes, typing new bin, it arrives something that is not a valid integer
        if (!isInt(newPos)) {
          newPos = 1;
          // newEnd = 100;
        }

        let newBin;
        if (byCol) {
          newPos = Math.min(
            self.last_col_pangenome,
            Math.max(1, Math.round(newPos))
          );

          if (!zoom) {
            newBin = self.binByCol(newPos);

            if (newBin !== undefined) {
              newPos = newBin;
              byCol = false;
            }
          }
        } else {
          newPos = Math.min(
            self.last_bin_pangenome,
            Math.max(1, Math.round(newPos))
          );
        }

        let leftLoaded = -1;
        let rightLoaded = -1;

        let sortedKeys = self.sortedComponentsKeys;

        if (sortedKeys.length > 0 && !byCol && !zoom) {
          let firstBinInComponents = self.components.get(
            sortedKeys[0]
          ).firstBin;
          let lastBinInComponents = self.components.get(
            sortedKeys[sortedKeys.length - 1]
          ).lastBin;

          if (
            lastBinInComponents <
            Math.min(newPos + 0.5 * self.columnsInView, self.last_bin_pangenome)
          ) {
            let pa;
            [pa, rightLoaded] = self.shiftComponentsRight(
              newPos,
              0.5 * self.columnsInView,
              false,
              false
            );
            promiseArray = promiseArray.concat(pa);

            if (newPos > lastBinInComponents) {
              let pa;
              [pa, leftLoaded] = self.shiftComponentsLeft(
                newPos,
                0.5 * self.columnsInView,
                false,
                false
              );
              promiseArray = promiseArray.concat(pa);
            }

            Promise.all(promiseArray).then(() => {
              self.shiftVisualisedComponentsCentre(newPos, byCol, highlight);
              self.mainUpdate(newPos, leftLoaded, rightLoaded);
              promiseArray = [];
            });
          } else if (
            firstBinInComponents >
            Math.max(newPos - 0.5 * self.columnsInView, 1)
          ) {
            let pa;
            [pa, leftLoaded] = self.shiftComponentsLeft(
              newPos,
              0.5 * self.columnsInView,
              false,
              false
            );
            promiseArray = promiseArray.concat(pa);

            if (newPos < firstBinInComponents) {
              let pa;
              [pa, rightLoaded] = self.shiftComponentsRight(
                newPos,
                0.5 * self.columnsInView,
                false,
                false
              );
              promiseArray = promiseArray.concat(pa);
            }
            Promise.all(promiseArray).then(() => {
              self.shiftVisualisedComponentsCentre(newPos, byCol, highlight);
              self.mainUpdate(newPos, leftLoaded, rightLoaded);
              promiseArray = [];
            });
          } else {
            self.shiftVisualisedComponentsCentre(newPos, byCol, highlight);
            self.mainUpdate(newPos, leftLoaded, rightLoaded);
          }
        } else {
          let multiplier = 1;
          if (zoom) {
            multiplier = parseInt(self.selectedZoomLevel);
          }

          let pa;
          [pa, leftLoaded] = self.shiftComponentsLeft(
            newPos,
            0.5 * self.columnsInView,
            byCol,
            false
          );
          promiseArray = promiseArray.concat(pa);

          [pa, rightLoaded] = self.shiftComponentsRight(
            newPos,
            0.5 * self.columnsInView,
            byCol,
            false
          );
          promiseArray = promiseArray.concat(pa);

          Promise.all(promiseArray).then(() => {
            if (!zoom) {
              self.clearVisualisedComponents();
            }

            self.shiftVisualisedComponentsCentre(newPos, byCol, highlight);
            if (zoomHighlight.length == 2) {
              self.setZoomHighlightBoundaries(...zoomHighlight);
              setTimeout(() => {
                self.clearZoomHighlightBoundaries();
              }, 10000);
            }
            setTimeout(() => {
              self.clearOldZoomLevelComponents().then(() => {
                self.mainUpdate(newPos, leftLoaded, rightLoaded, byCol, !zoom);
              });
            }, 0);
          });
        }
      }
    },

    updateHighlightedLink(linkRect) {
      if (linkRect) {
        if (linkRect instanceof Array) {
          self.highlightedLink = [linkRect[0], linkRect[1]];
        } else {
          self.highlightedLink = [linkRect.upstreamCol, linkRect.downstreamCol];
        }
      } else {
        self.highlightedLink = null;
      }
    },

    updateCellTooltipContent(newContents) {
      self.cellToolTipContent = String(newContents);
    },

    updateHeight(event) {
      self.pixelsPerRow = checkAndForceMinOrMaxValue(
        Number(event.target.value),
        1,
        30
      );
    },

    updateWidth(value) {
      let newPixInCol = checkAndForceMinOrMaxValue(Number(value), 3, 30);
      if (newPixInCol != self.pixelsPerColumn) {
        self.pixelsPerColumn = newPixInCol;
        self.updatePosition(self.getPosition);
      }
      self.editingPixelsPerColumn = newPixInCol;
    },

    updateEditingWidth(value) {
      self.editingPixelsPerColumn = Number(value);
    },

    setUpdatingVisible() {
      self.updatingVisible = true;
    },

    clearUpdatingVisible() {
      self.updatingVisible = false;
    },

    setIndexSelectedZoomLevel(index) {
      // Changing zoom level.

      self.updatingVisible = true;

      self.breakComponentUpdate = true;

      if (self.loading) {
        setTimeout(() => {
          self.setIndexSelectedZoomLevel(index);
        }, 100);
      } else {
        self.breakComponentUpdate = false;

        let scaleFactor =
          self.availableZoomLevels[self.indexSelectedZoomLevel] /
          self.availableZoomLevels[index];
        let newZoomLevel = parseInt(self.availableZoomLevels[index]);

        // Calculating the first column of the begin, central and end bin.
        // It will make it easier to find proper centre and edges on the other zoom level.

        let centralColumn = self.visibleColFromBin(self.position);
        let leftColumn = self.visibleColFromBin(self.getBeginBin, 0);
        let rightColumn = self.visibleColFromBin(self.getEndBin, 2);

        self.indexSelectedZoomLevel = index;

        let promiseArray = [];
        if (scaleFactor < 1) {
          self.updatePosition(
            centralColumn,
            false,
            true,
            [leftColumn, rightColumn],
            true
          );
        } else {
          self.updatePosition(centralColumn, false, true, false, true);
        }
      }
    },

    setPosition(newPos) {
      self.setEditingPosition(newPos);
      self.position = newPos;
    },

    setEditingPosition(newPos) {
      self.editingPosition = newPos;
    },

    updateSearchTerms(path, searchType, search) {
      if (path !== undefined) {
        self.searchTerms.path = path;
      }

      if (searchType !== undefined) {
        self.searchTerms.searchType = parseInt(searchType);
      }

      if (search !== undefined) {
        self.searchTerms.search = search;
      }
    },

    setLoading(val) {
      self.loading = val;
    },

    setChunkLoading() {
      self.chunkLoading = true;
    },

    unsetChunkLoading() {
      self.chunkLoading = false;
    },

    addToSelection(colStart, colEnd) {
      // selecting components
      let newSelection = [];

      let numIntersections = 0;

      self.selectedComponents.forEach((val) => {
        if ((colEnd - val[0]) * (val[1] - colStart) > 0) {
          numIntersections += 1;
          newSelection.push([
            Math.min(colStart, val[0]),
            Math.max(colEnd, val[1]),
          ]);
        } else {
          newSelection.push(val);
        }
      });

      if (numIntersections === 0) {
        newSelection.push([colStart, colEnd]);
      }

      self.selectedComponents = cast(newSelection);
    },

    delFromSelection(colStart, colEnd) {
      // deselecting components
      // Removing all selected intervals that intersect with the given one.
      const newSelection = [];

      self.selectedComponents.forEach((val) => {
        if ((colEnd - val[0]) * (val[1] - colStart) >= 0) {
          const intersection = [
            Math.max(colStart, val[0]),
            Math.min(colEnd, val[1]),
          ];

          if (intersection[0] - val[0] > 0) {
            newSelection.push([val[0], intersection[0] - 1]);
          }

          if (val[1] - intersection[1] > 0) {
            newSelection.push([intersection[1] + 1, val[1]]);
          }
        } else {
          newSelection.push(val);
        }
      });
      self.selectedComponents = newSelection;
    },

    isInSelection(colStart, colEnd) {
      return (
        self.selectedComponents.filter((val) => {
          return (colEnd - val[0]) * (val[1] - colStart) > 0;
        }).length > 0
      );
    },
  }))
  .views((self) => ({
    get getBeginBin() {
      return self.beginBinVisual;
    },
    get getEndBin() {
      return self.endBinVisual;
    },
    get getPosition() {
      return self.position;
    },

    // Getter and setter for zoom info management
    get getBinWidth() {
      //Zoom level and BinWidth are actually the same thing
      return Number(self.selectedZoomLevel);
    },
    get availableZoomLevels() {
      if (self.chunkIndex === null) {
        return ["1"];
      } else {
        return Array.from(self.chunkIndex.zoom_levels.keys());
      }
    },
    get actualWidth() {
      return self.columnsInView * self.pixelsPerColumn + 2;
    },
    get selectedZoomLevel() {
      //This is a genuinely useful getter
      let a = self.availableZoomLevels[self.indexSelectedZoomLevel];

      return a ? a : "1";
    },
    get last_bin_pangenome() {
      if (self.chunkIndex === null) {
        return 0;
      }

      return self.chunkIndex.zoom_levels.get(self.selectedZoomLevel).last_bin;
    },

    get last_col_pangenome() {
      if (self.chunkIndex === null) {
        return 0;
      }

      return self.chunkIndex.zoom_levels.get(self.selectedZoomLevel).last_col;
    },
    get columnsInView() {
      return Math.floor(self.windowWidth / self.pixelsPerColumn);
    },
    get centreBinEndPos() {
      return self.leftHalfCols * self.pixelsPerColumn;
    },
    get leftHalfCols() {
      return Math.round(self.columnsInView / 2);
    },
    get rightHalfCols() {
      return self.columnsInView - self.leftHalfCols;
    },
    get navigation_bar_width() {
      return self.windowWidth - 2;
    },
    get x_navigation() {
      if (self.getBeginBin === 1) {
        return 0;
      } else {
        return Math.ceil(
          (self.getBeginBin / self.last_bin_pangenome) *
            self.navigation_bar_width
        );
      }
    },

    get width_navigation() {
      let widthNav = Math.ceil(
        ((self.getEndBin - self.getBeginBin + 1) / self.last_bin_pangenome) *
          self.navigation_bar_width
      );

      if (self.x_navigation + widthNav > self.navigation_bar_width) {
        widthNav = self.navigation_bar_width - self.x_navigation;
      }

      if (self.getBeginBin > self.getEndBin) {
        widthNav = 1;
      }

      return widthNav;
    },

    get sortedComponentsKeys() {
      let sortedKeys = keys(self.components);

      return filter_sort_index_array(sortedKeys, self.selectedZoomLevel);
    },

    get sortedVisualComponentsKeys() {
      let sortedKeys = keys(self.visualisedComponents);
      return filter_sort_index_array(sortedKeys, self.selectedZoomLevel);
    },

    get firstLoadedBin() {
      return self.components.get(self.sortedComponentsKeys[0]).firstBin;
    },

    get lastLoadedBin() {
      let sortedKeys = self.sortedComponentsKeys;
      return self.components.get(sortedKeys[sortedKeys.length - 1]).lastBin;
    },

    get firstVisualBin() {
      return self.components.get(self.sortedVisualComponentsKeys[0]).firstBin;
    },

    get lastVisualBin() {
      let sortedKeys = self.sortedVisualComponentsKeys;
      return self.components.get(sortedKeys[sortedKeys.length - 1]).lastBin;
    },
    get topOffset() {
      let res = self.heightNavigationBar + self.maxArrowHeight;

      return res;
    },

    linkInView(bin, zoomLevel) {
      return values(self.visualisedComponents).find((comp) => {
        return (
          ((comp.lastBin === bin &&
            self.getEndBin >= comp.lastBin &&
            comp.departureVisible) ||
            (comp.firstBin === bin &&
              self.getBeginBin <= comp.firstBin &&
              comp.arrivalVisible)) &&
          comp.zoom_level === zoomLevel
        );
      });
    },
    visibleCompByBin(bin, zoom = "auto") {
      let _zoom = zoom;
      if (zoom === "auto") {
        _zoom = self.selectedZoomLevel;
      }

      let res = values(self.visualisedComponents).find((comp) => {
        return (
          comp.lastBin >= bin &&
          comp.firstBin <= bin &&
          comp.zoom_level == _zoom
        );
      });

      if (res === undefined) {
        res = values(self.visualisedComponents).find((comp) => {
          return comp.lastBin >= bin && comp.firstBin <= bin;
        });
      }
      return res;
    },

    binByCol(col) {
      let res = values(self.components).find((comp) => {
        return comp.lastCol >= col && comp.firstCol <= col;
      });

      if (res !== undefined) {
        let binStart = res.binColStarts.findLastIndex((colStart) => {
          return colStart <= col;
        });

        return binStart + res.firstBin;
      } else {
        return res;
      }
    },

    compByBin(bin, zoom = "auto") {
      let _zoom = zoom;
      if (zoom === "auto") {
        _zoom = self.selectedZoomLevel;
      }

      // Will return undefined if nothing was found.
      let res = values(self.components).find((comp) => {
        return (
          comp.lastBin >= bin &&
          comp.firstBin <= bin &&
          comp.zoom_level == _zoom
        );
      });

      if (res === undefined && zoom !== "auto") {
        res = values(self.components).find((comp) => {
          return comp.lastBin >= bin && comp.firstBin <= bin;
        });
      }
      return res;
    },

    visibleColFromBin(bin, pos = 1) {
      // Pos indicates whether left (0), centre (1) or right (2) of the bin should be taken
      // Default is centre.

      let comp = self.visibleCompByBin(bin);
      let relBin = bin - comp.firstBin; // 0-based
      // Change to startCol and endCol of the bin
      let binColStart = comp.binColStarts.get(relBin);
      let binColEnd = comp.binColEnds.get(relBin);

      let col;

      switch (pos) {
        case 0:
          col = binColStart;
          break;
        case 2:
          col = binColEnd;
          break;
        default:
          col = binColStart + Math.round((binColEnd - binColStart) / 2);
      }

      return col;
    },
  }));

export const store = RootStore.create({});
