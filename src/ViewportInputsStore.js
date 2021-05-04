import { types } from "mobx-state-tree";
import { urlExists } from "./URL";
import { arraysEqual, checkAndForceMinOrMaxValue, isInt } from "./utilities";

class JSONCache {
  constructor() {
    this.cacheAvailable = "caches" in window;

    if (this.cacheAvailable) {
      caches.delete("jsonData");
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
        // console.error(`File ${url} does not exist`);
        throw `File ${url} does not exist`;
      }
    } else {
      let res = fetch(new Request(url))
        .then((response) => {
          response.json();
          this.cache.set(response.url, response);
          return response;
        })
        .catch((error) => {
          // console.error(`Fetch error: URL ${url} did not return expected format file - ${error}`);
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
      console.debug("[JSONCache._addURL] data is provided");
      this._addData(url, data);
    } else {
      console.debug("[JSONCache._addURL] data is not provided");

      return this._fetchJSON(url);
    }
  }

  getJSON(url) {
    console.debug(this.cache.keys());
    let result = this.cache.match(url).then((response) => {
      if (response) {
        console.debug("[JSONCache.getJSON] Got from cache");
        return response;
      } else {
        console.debug("[JSONCache.getJSON] Fetched from server");
        return this._addURL(url);
      }
    });

    return result.then((response) => {
      console.debug(response);
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

const BinData = types.model({
  repeats: types.number,
  reversal: types.number,
  startPos: types.optional(types.integer, 0),
  endPos: types.optional(types.integer, 0),
});

const ComponentMatrixElement = types
  .model({
    pathID: types.identifierNumber,
    occupiedBins: types.array(types.integer),
    binData: types.array(BinData),
  })
  .actions((self) => ({
    addBinData(binArray) {
      for (const bin of binArray) {
        self.binData.push({
          repeats: bin[0],
          reversal: bin[1],
          startPos: bin[2][0],
          endPos: bin[2][1],
        });
      }
    },
  }));

const LinkColumn = types
  .model({
    upstream: types.integer,
    downstream: types.integer,
    participants: types.array(types.integer),
  })
  .views((self) => ({
    get key() {
      return (
        String(this.downstream).padStart(13, "0") +
        String(this.upstream).padStart(13, "0")
      );
    },
  }));

const Component = types
  .model({
    index: types.identifier,
    columnX: types.integer,
    compressedColumnX: types.integer,
    firstBin: types.integer,
    lastBin: types.integer,
    firstCol: types.integer,
    lastCol: types.integer,
    arrivals: types.map(LinkColumn),
    departures: types.map(LinkColumn),
    relativePixelX: types.optional(types.integer, -1),
    occupants: types.array(types.integer),
    numBins: types.integer,
    matrix: types.map(ComponentMatrixElement),
  })
  .actions((self) => ({
    addMatrixElement(matrixElement) {
      let mel = ComponentMatrixElement.create({
        pathID: matrixElement[0],
        occupiedBins: matrixElement[1][0],
      });
      mel.addBinData(matrixElement[1][1]);
      self.matrix.set(mel.pathID, mel);
    },

    addMatrixElements(matrix) {
      for (const el of matrix) {
        self.addMatrixElement(el);
      }
    },

    addArrivalLinks(linkArray) {
      for (const link in linkArray) {
        let linkCol = LinkColumn.create(link);
        self.arrivals.set(linkCol.key, linkCol);
      }
    },

    addDepartureLinks(linkArray) {
      for (const link in linkArray) {
        let linkCol = LinkColumn.create(link);
        self.departures.set(linkCol.key, linkCol);
      }
    },

    moveTo(newRelativePixelX) {
      self.relativePixelX = newRelativePixelX;
    },

    getColumnX(useWidthCompression) {
      return useWidthCompression ? self.compressedColumnX : self.columnX;
    },
  }));

const Chunk = types.model({
  file: types.string,
  fasta: types.maybeNull(types.string),
  first_bin: types.integer,
  last_bin: types.integer,
  x: types.integer,
  compressedX: types.integer,
});
const ZoomLevel = types.model({
  bin_width: types.integer,
  last_bin: types.integer,
  files: types.array(Chunk),
});
const ChunkIndex = types.maybeNull(
  types.model({
    json_version: 14,
    pangenome_length: types.integer,
    zoom_levels: types.map(ZoomLevel),
  })
);
const PathNucPos = types.model("PathNucPos", {
  path: types.string,
  nucPos: types.integer,
});

const metaDataModelEntry = types.model({
  Path: types.identifier,
  Color: types.string,
  Info: types.string,
});

let RootStore;
RootStore = types
  .model({
    chunkIndex: ChunkIndex,
    beginEndBin: types.optional(types.array(types.integer), [1, 100]),
    useVerticalCompression: false,
    useWidthCompression: false,
    binScalingFactor: 3,
    useConnector: true,
    pixelsPerColumn: 10,
    pixelsPerRow: 10,
    heightNavigationBar: 25,
    leftOffset: 1,
    topOffset: 400,
    highlightedLink: 0, // we will compare linkColumns
    maximumHeightThisFrame: 150,
    cellToolTipContent: "",
    jsonName: "AT_Chr1_OGOnly_strandReversal_new.seg", //"shorttest1_new.seg", //"small_test.v17", //"AT_Chr1_OGOnly_strandReversal.seg", //"SARS-CoV-2.genbank.small",
    // Added attributes for the zoom level management
    availableZoomLevels: types.optional(types.array(types.string), ["1"]),

    precIndexSelectedZoomLevel: 0,
    indexSelectedZoomLevel: 0,

    chunkURLs: types.optional(types.array(types.string), []),
    chunkFastaURLs: types.optional(types.array(types.string), []),
    //to be compared against chunkURLs
    chunksProcessed: types.optional(types.array(types.string), []),
    chunksProcessedFasta: types.optional(types.array(types.string), []),

    pathNucPos: types.optional(PathNucPos, { path: "path", nucPos: 0 }), // OR: types.maybe(PathNucPos)
    pathIndexServerAddress: "http://localhost:3010", // "http://193.196.29.24:3010/",

    loading: true,
    copyNumberColorArray: types.optional(types.array(types.string), [
      "#6a6a6a",
      "#5f5f5f",
      "#545454",
      "#4a4a4a",
      "#3f3f3f",
      "#353535",
      "#2a2a2a",
      "#1f1f1f",
      "#151515",
      "#0a0a0a",
      "#000000",
    ]),
    invertedColorArray: types.optional(types.array(types.string), [
      "#de4b39",
      "#c74333",
      "#b13c2d",
      "#9b3427",
      "#852d22",
      "#6f251c",
      "#581e16",
      "#421611",
      "#2c0f0b",
      "#160705",
      "#000000",
    ]),

    last_bin_pangenome: 0,

    colorByGeneAnnotation: true,
    metaDataKey: "Path",
    metaData: types.map(metaDataModelEntry),
    //metaDataChoices: types.array(types.string)
    selectedComponents: types.optional(
      types.array(types.array(types.integer)),
      []
    ),
    zoomHighlightBoundaries: types.array(types.integer),
    components: types.map(Component),
  })
  .actions((self) => ({
    addComponent(component) {
      // Component index by first zoom
      let curComp = Component.create({
        columnX: component.x,
        compressedColumnX: component.compressedX,

        index: component.first_bin,
        firstBin: component.first_bin,
        lastBin: component.last_bin,

        firstCol: component.firstCol,
        lastCol: component.lastCol,

        relativePixelX: -1,

        // deep copy of occupants
        occupants: component.occupants,
        num_bin: component.last_bin - component.first_bin + 1,
      });
      curComp.addMatrixElements(component.matrix);
      curComp.addArrivalLinks(component.arrivals);
      curComp.addDepartureLinks(component.departures);
    },

    addComponents(compArray) {
      for (const component of compArray) {
        self.addComponent(component);
      }
    },

    setZoomHighlightBoundaries(startBin, endBin) {
      self.zoomHighlightBoundaries = [startBin, endBin];
    },

    clearZoomHighlightBoundaries() {
      self.zoomHighlightBoundaries = [];
    },
    setChunkIndex(json) {
      console.log("STEP #2: chunkIndex contents loaded");
      //console.log("Index updated with content:", json);

      self.chunkIndex = null; // TODO: TEMPORARY HACK before understanding more in depth mobx-state or change approach

      self.chunkIndex = json;
    },

    updateBeginEndBin(newBegin, newEnd) {
      /*This method needs to be atomic to avoid spurious updates and out of date validation.*/

      // This function is called 5 times every time the bin number is updated.
      console.log("updateBeginEndBin - " + newBegin + " - " + newEnd);
      // Sometimes, typing new bin, it arrives something that is not a valid integer
      if (!isInt(newBegin) || !isInt(newEnd)) {
        newBegin = 1;
        newEnd = 100;
      }

      // TODO: manage a maxBeginBin based on the width of the last components in the pangenome
      newBegin = Math.min(
        self.last_bin_pangenome - 1,
        Math.max(1, Math.round(newBegin))
      );

      self.setBeginEndBin(newBegin, newEnd);
    },

    updateTopOffset(newTopOffset) {
      if (Number.isFinite(newTopOffset) && Number.isSafeInteger(newTopOffset)) {
        self.topOffset = newTopOffset + 10;
      }
    },

    updateBinScalingFactor(event) {
      let newFactor = event.target.value;
      self.binScalingFactor = Math.max(1, Number(newFactor));
    },

    updateHighlightedLink(linkRect) {
      self.highlightedLink = linkRect;
    },

    updateMaxHeight(latestHeight) {
      self.maximumHeightThisFrame = Math.max(
        self.maximumHeightThisFrame,
        latestHeight
      );
    },

    resetRenderStats() {
      self.maximumHeightThisFrame = 1;
    },

    updateCellTooltipContent(newContents) {
      self.cellToolTipContent = String(newContents);
    },

    toggleUseVerticalCompression() {
      self.useVerticalCompression = !self.useVerticalCompression;
    },

    toggleUseWidthCompression() {
      self.useWidthCompression = !self.useWidthCompression;
    },

    toggleUseConnector() {
      self.useConnector = !self.useConnector;
    },

    updateHeight(event) {
      self.pixelsPerRow = checkAndForceMinOrMaxValue(
        Number(event.target.value),
        1,
        30
      );
    },

    updateWidth(event) {
      self.pixelsPerColumn = checkAndForceMinOrMaxValue(
        Number(event.target.value),
        3,
        30
      );
    },

    tryJSONpath(event) {
      const url =
        process.env.PUBLIC_URL +
        "/test_data/" +
        event.target.value +
        "/bin2file.json";
      if (urlExists(url)) {
        console.log("STEP#1: New Data Source: " + event.target.value);
        self.jsonName = event.target.value;
      }
    },

    // Lifted down the control of the emptyness of the arrays
    switchChunkURLs(arrayOfFile) {
      if (!arraysEqual(arrayOfFile, self.chunkURLs)) {
        console.log("STEP #4: Set switchChunkURLs: " + arrayOfFile);
        self.chunkURLs = arrayOfFile;

        self.chunksProcessed = []; // Clear

        return true;
      }
      return false;
    },

    switchChunkFastaURLs(arrayOfFile) {
      if (!arraysEqual(arrayOfFile, self.chunkFastaURLs)) {
        console.log("STEP #4.fasta: Set switchChunkFastaURLs: " + arrayOfFile);
        self.chunkFastaURLs = arrayOfFile;

        self.chunksProcessedFasta = []; // Clear
      }
    },

    addChunkProcessed(singleChunk) {
      console.log("STEP #7: processed " + singleChunk);
      self.chunksProcessed.push(singleChunk);
    },

    addChunkProcessedFasta(singleChunkFasta) {
      console.log("STEP #7.FASTA: processed " + singleChunkFasta);
      self.chunksProcessedFasta.push(singleChunkFasta);
    },

    //TODO: Split into getter and setter, mover getter to `views`
    getSelectedZoomLevel(get_prec_zoom_level = false) {
      //This is a genuinely useful getter
      let a =
        self.availableZoomLevels[
          get_prec_zoom_level
            ? self.precIndexSelectedZoomLevel
            : self.indexSelectedZoomLevel
        ];

      // Clear precIndexSelectedZoomLevel (it is usable only one time)
      if (get_prec_zoom_level) {
        self.precIndexSelectedZoomLevel = self.indexSelectedZoomLevel;
      }

      return a ? a : "1";
    },

    setIndexSelectedZoomLevel(index) {
      self.precIndexSelectedZoomLevel = self.indexSelectedZoomLevel;
      self.indexSelectedZoomLevel = index;
    },

    setAvailableZoomLevels(availableZoomLevels) {
      let arr = [...availableZoomLevels];

      self.availableZoomLevels = arr;
    },

    setBeginEndBin(newBeginBin, newEndBin) {
      self.beginEndBin = [newBeginBin, newEndBin];
    },

    updatePathNucPos(path, nucPos) {
      //console.log('updatePathNucPos: ' + path + ' --- ' + nucPos)

      if (path !== undefined) {
        if (nucPos) {
          nucPos = Math.abs(parseInt(nucPos));
        } else {
          nucPos = 0;
        }
        self.pathNucPos = { path: path, nucPos: nucPos };
      }
    },

    setLoading(val) {
      self.loading = val;
    },

    setLastBinPangenome(val) {
      self.last_bin_pangenome = val;
    },

    /*function toggleColorByGeo() {
      self.colorByGeo = !self.colorByGeo;
    }*/
    setMetaData(metadata) {
      for (let [key, value] of Object.entries(metadata)) {
        self.metaData.set(key, value);
      }
    },

    getMetaData(key) {
      self.metaData.get(key);
    },

    setMetaDataChoices(ar) {
      self.metaDataChoices = ar;
    },

    addToSelection(colStart, colEnd) {
      self.selectedComponents.push([colStart, colEnd]);
    },

    delFromSelection(colStart, colEnd) {
      // Removing all selected intervals that intersect with the given one.
      const newSelection = [];

      self.selectedComponents.forEach((val) => {
        if ((colEnd - val[0]) * (val[1] - colStart) > 0) {
          const intersection = [
            Math.max(colStart, val[0]),
            Math.min(colEnd, val[1]),
          ];

          if (intersection[0] - val[0] > 0) {
            newSelection.push([val[0], intersection[0]]);
          }

          if (intersection[1] - val[1] > 0) {
            newSelection.push([val[1], intersection[1]]);
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
    // return {
    //   setChunkIndex,
    //   updateBeginEndBin,
    //   updateTopOffset,
    //   updateHighlightedLink,
    //   updateMaxHeight,
    //   resetRenderStats,
    //   updateCellTooltipContent,
    //   updateBinScalingFactor,
    //   toggleUseVerticalCompression,
    //   toggleUseWidthCompression,
    //   toggleUseConnector,
    //   updateHeight,
    //   updateWidth,
    //   tryJSONpath,

    //   switchChunkURLs,
    //   switchChunkFastaURLs,
    //   addChunkProcessed,
    //   addChunkProcessedFasta,

    //   getBeginBin,
    //   getEndBin,
    //   updatePathNucPos,

    //   //NOTE: DO NOT ADD GETTERS here.  They are not necessary in mobx.
    //   // You can reference store.val directly without store.getVal()
    //   //Only write getters to encapsulate useful logic for derived values

    //   // Added zoom actions
    //   getBinWidth,
    //   getSelectedZoomLevel,
    //   setIndexSelectedZoomLevel,
    //   setAvailableZoomLevels,

    //   setLoading,

    //   setLastBinPangenome,

    //   //toggleColorByGeo,
    //   setMetaData,
    //   getMetaData,
    //   setMetaDataChoices,
    // };
  }))
  .views((self) => ({
    get getBeginBin() {
      return self.beginEndBin[0];
    },
    get getEndBin() {
      return self.beginEndBin[1];
    },

    // Getter and setter for zoom info management
    get getBinWidth() {
      //Zoom level and BinWidth are actually the same thing
      return Number(self.getSelectedZoomLevel());
    },
  }));

export const store = RootStore.create({});
