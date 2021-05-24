import { types } from "mobx-state-tree";
import { entries, keys, values } from "mobx";
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
      // console.debug("[JSONCache._addURL] data is provided");
      this._addData(url, data);
    } else {
      // console.debug("[JSONCache._addURL] data is not provided");

      return this._fetchJSON(url);
    }
  }

  getRaw(url) {
    let result = this.cache.match(url).then((response) => {
      if (response) {
        // console.debug("[JSONCache.getJSON] Got from cache");
        return response;
      } else {
        // console.debug("[JSONCache.getJSON] Fetched from server");
        return this._addURL(url);
      }
    });

    return result;
  }

  getJSON(url) {
    return this.getRaw(url).then((response) => {
      // console.debug(response);
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

const BinData = types.model({
  repeats: types.number,
  reversal: types.number,
  pos: types.array(types.array(types.integer)),
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
          pos: bin[2],
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
    index: types.identifierNumber,
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
      for (const link of linkArray) {
        // console.debug("[Component.addArrivalLinks]", link)
        let linkCol = LinkColumn.create(link);
        self.arrivals.set(linkCol.key, linkCol);
      }
    },

    addDepartureLinks(linkArray) {
      for (const link of linkArray) {
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
const ChunkIndex = types.model({
  json_version: 14,
  pangenome_length: types.integer,
  pathNames: types.array(types.string),
  zoom_levels: types.map(ZoomLevel),
});

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
    // this.jsonCache = {}; // URL keys, values are entire JSON file datas
    // TODO: make jsonCache store React components and save them in mobx
    // TODO: make FILO queue to remove old jsonCache once we hit max memory usage
    nucleotides: types.array(types.string), // nucleotides attribute and its edges

    // this.metadata = []; This will be used later to store annotation possibly.

    chunkIndex: types.maybeNull(ChunkIndex),
    beginBin: types.optional(types.integer, 1),
    editingBeginBin: types.optional(types.integer, 1),
    endBin: types.optional(types.integer, 1),
    useVerticalCompression: false,
    useWidthCompression: false,
    binScalingFactor: 3,
    useConnector: true,
    pixelsPerColumn: 10,
    pixelsPerRow: 10,
    heightNavigationBar: 25,
    leftOffset: 1,
    topOffset: 70,
    highlightedLink: 0, // we will compare linkColumns
    cellToolTipContent: "",
    jsonName: "AT_Chr1_OGOnly_strandReversal_new.seg", //"shorttest1_new.seg", //"small_test.v17", //"AT_Chr1_OGOnly_strandReversal.seg", //"SARS-CoV-2.genbank.small",
    // Added attributes for the zoom level management
    // availableZoomLevels: types.optional(types.array(types.string), ["1"]),

    scaleFactor: 1,
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
    visualisedComponents: types.map(
      types.reference(types.late(() => Component))
    ),
    // columnsInView: types.optional(types.integer,0),
    windowWidth: types.optional(types.integer, 0),
    mouseX: types.optional(types.integer, 0),
    mouseY: types.optional(types.integer, 0),
    updatingVisible: false,
  })
  .actions((self) => ({
    updateMouse(x, y) {
      self.mouseX = x;
      self.mouseY = y;
    },

    updateWindow(windowWidth) {
      self.windowWidth = windowWidth;
      self.updateBeginEndBin(self.getBeginBin);
    },

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
        numBins: component.last_bin - component.first_bin + 1,
      });
      // console.debug("[Store.addComponent]",component )
      curComp.addMatrixElements(component.matrix);
      curComp.addArrivalLinks(component.arrivals);
      curComp.addDepartureLinks(component.departures);
      // console.debug("[Store.addComponent]",curComp);
      self.components.set(curComp.index, curComp);
    },

    addComponents(compArray, nucleotides = [], fromRight = true) {
      // debugger;

      let splicing = 0;

      if (compArray[0].first_bin === 0) {
        splicing = 1;
      }
      let offset = compArray[splicing].first_bin;
      for (const component of compArray.splice(splicing)) {
        if (!self.components.has(component.first_bin)) {
          self.addComponent(component);
          if (nucleotides.length > 0) {
            self.addNucleotideSequence(
              nucleotides.slice(
                component.first_bin - offset,
                component.last_bin - offset + 1
              ),
              fromRight
            );
          }
        }
      }
    },

    addComponentsFromURL(url, fastaURL, fromRight = true) {
      return jsonCache
        .getJSON(
          `${process.env.PUBLIC_URL}/test_data/${self.jsonName}/${self.selectedZoomLevel}/${url}`
        )
        .then((data) => {
          if (fastaURL === null) {
            return Promise.resolve([data.components, [], fromRight]);
          } else {
            return self
              .addNucleotidesFromFasta(
                `${process.env.PUBLIC_URL}/test_data/${self.jsonName}/${self.selectedZoomLevel}/${fastaURL}`
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

    addNucleotideSequence(sequence, fromRight) {
      console.debug("[Store.addNucleotideSequence]");
      if (fromRight) {
        self.nucleotides.splice(self.nucleotides.length, 0, ...sequence);
      } else {
        self.nucleotides.splice(0, 0, ...sequence);
      }
    },

    addNucleotidesFromFasta(url) {
      return jsonCache
        .getRaw(url)
        .then((data) => data.text())
        .then((data) => {
          let sequence = data
            .replace(/.*/, "")
            .substr(1)
            .replace(/[\r\n]+/gm, "");

          return sequence;
          // console.debug("[Store.addNucleotidesFromFasta] nucleotides", self.nucleotides)
        })
        .catch((err) => {
          console.debug("Cannot load nucleotides: ", err);
        });
    },

    shiftComponentsRight(windowStart, windowEnd, doClean = true) {
      // console.debug("[Store.shiftComponentsRight] component store before removal",self.components)
      // console.debug("[Store.shiftComponentsRight] windowStart windowEnd",windowStart, windowEnd)
      // debugger;
      let lastBin = windowStart;

      if (doClean && self.components.size > 0) {
        // for (let [index,comp] of entries(self.components)) {
        //   if (comp.lastBin<windowStart) {
        //     // console.debug("[Store.shiftComponentsRight] component to remove",comp)
        //     if (self.nucleotides.length>0) {
        //       self.removeNucleotides(comp.numBins,false);
        //     }
        //     self.removeComponent(index);
        //   }
        // }
        self.removeComponents(windowStart, true);

        lastBin = Array.from(
          self.components.values(),
          (comp) => comp.lastBin
        ).pop();

        lastBin = lastBin ? lastBin : 0;
      }

      let doUpdateVisual = false;

      // console.debug("[Store.shiftComponentsRight] component store before adding new components",self.components);
      // console.debug("[Store.shiftComponentsRight] index files for zoom level",self.chunkIndex.zoom_levels.get(self.selectedZoomLevel).files);

      // console.debug("[Store.shiftComponentsRight] window start and end",windowStart,windowEnd);
      // console.debug("[Store.shiftComponentsRight] lastbin",lastBin);
      let promiseArray = [];

      for (let chunkFile of self.chunkIndex.zoom_levels.get(
        self.selectedZoomLevel
      ).files) {
        if (
          lastBin < chunkFile.last_bin &&
          (windowEnd - chunkFile.first_bin) *
            (chunkFile.last_bin - windowStart) >
            0
        ) {
          if (
            (self.getEndBin - chunkFile.first_bin) *
              (chunkFile.last_bin - self.getBeginBin) >
              0 &&
            self.getEndBin >= self.getBeginBin
          ) {
            doUpdateVisual = true;
          }
          //remove addNucleotideFromFasta
          promiseArray.push(
            self.addComponentsFromURL(chunkFile.file, chunkFile.fasta, true)
          );
          // if (chunkFile.fasta !== null) {
          //   promiseArray.push(self.addNucleotidesFromFasta(`${process.env.PUBLIC_URL}/test_data/${self.jsonName}/${self.selectedZoomLevel}/${chunkFile.fasta}`,doClean));
          // }
        }
      }

      if (doUpdateVisual && doClean) {
        Promise.all(promiseArray).then((values) => {
          self.shiftVisualisedComponents();
        });
      }
      if (!doClean) {
        return promiseArray;
      }
    },

    shiftComponentsLeft(windowStart, windowEnd, doClean = true) {
      let firstBin = windowEnd;

      // console.debug("[Store.shiftComponentsLeft] windowStart windowEnd",windowStart, windowEnd)
      if (doClean && self.components.size > 0) {
        // for (let [index,comp] of entries(self.components)) {
        //   if (comp.firstBin>windowEnd) {
        //     self.removeNucleotides(comp.lastBin-comp.firstBin,true);
        //     self.removeComponent(index);
        //   }
        // }
        self.removeComponents(windowEnd, false);
        firstBin = self.components.values().next().value.firstBin;

        firstBin = firstBin ? firstBin : 0;
      }

      let doUpdateVisual = false;
      promiseArray = [];

      for (let chunkFile of self.chunkIndex.zoom_levels.get(
        self.selectedZoomLevel
      ).files) {
        if (
          firstBin > chunkFile.first_bin &&
          (windowEnd - chunkFile.first_bin) *
            (chunkFile.last_bin - windowStart) >
            0
        ) {
          if (
            (self.getEndBin - chunkFile.first_bin) *
              (chunkFile.last_bin - self.getBeginBin) >
            0
          ) {
            doUpdateVisual = true;
          }
          promiseArray.push(
            self.addComponentsFromURL(chunkFile.file, chunkFile.fasta, false)
          );

          // if (chunkFile.fasta !== null) {
          //   promiseArray.push(self.addNucleotidesFromFasta(`${process.env.PUBLIC_URL}/test_data/${self.jsonName}/${self.selectedZoomLevel}/${chunkFile.fasta}`,false));
          // }
        }
      }

      if (doUpdateVisual && doClean) {
        Promise.all(promiseArray).then((values) => {
          self.shiftVisualisedComponents();
          promiseArray = undefined;
        });
      }

      if (!doClean) {
        return promiseArray;
      }
    },

    removeComponent(id) {
      self.components.delete(id);
    },

    removeNucleotides(length, fromBeginning) {
      console.debug("[Store.removeNucleotides]");
      if (self.nucleotides.length > 0) {
        if (fromBeginning) {
          self.nucleotides.splice(0, length);
        } else {
          self.nucleotides.splice(self.nucleotides.length - length, length);
        }
        // need to implement, see `removeComponent` for reference.
      }
    },

    removeComponents(lastStop, fromBeginning) {
      for (let index of self.sortedComponentsKeys) {
        let comp = self.components.get(index);
        if (fromBeginning) {
          if (comp.lastBin < lastStop) {
            self.removeNucleotides(comp.numBins, fromBeginning);
            self.removeComponent(comp.firstBin);
          } else {
            break;
          }
        } else {
          if (comp.firstBin > lastStop) {
            self.removeNucleotides(comp.numBins, fromBeginning);
            self.removeComponent(comp.firstBin);
          }
        }
      }
    },

    clearComponents() {
      console.debug("[Store.clearComponents]");
      self.visualisedComponents.clear();
      self.nucleotides = [];
      self.components.clear();
    },

    setZoomHighlightBoundaries(startBin, endBin) {
      self.zoomHighlightBoundaries = [startBin, endBin];
    },

    clearZoomHighlightBoundaries() {
      self.zoomHighlightBoundaries = [];
    },

    loadIndexFile() {
      console.log("STEP #1: whenever jsonName changes, loadIndexFile");
      self.setLoading(true);
      let indexPath =
        process.env.PUBLIC_URL +
        "/test_data/" +
        self.jsonName +
        "/bin2file.json";
      //console.log("loadIndexFile - START reading", indexPath);

      return fetch(indexPath)
        .then((res) => res.json())
        .then((json) => {
          console.log("loadIndexFile - END reading", indexPath);

          //STEP #2: chunkIndex contents loaded
          self.setChunkIndex(json);
          self.setLoading(false);
        });
    },

    setChunkIndex(json) {
      console.log("STEP #2: chunkIndex contents loaded");
      //console.log("Index updated with content:", json);

      // self.chunkIndex = null; // TODO: TEMPORARY HACK before understanding more in depth mobx-state or change approach

      self.chunkIndex = { ...json };
    },

    clearVisualisedComponents() {
      for (let key of keys(self.visualisedComponents)) {
        if (self.components.has(key)) {
          self.components.get(key).moveTo(-1);
        }
      }
      self.visualisedComponents.clear();
    },

    shiftVisualisedComponentsCentre(centreBin) {
      // console.debug("[Store.shiftVisualisedComponentsCentre] centreBin", centreBin)
      // console.debug("[Store.shiftVisualisedComponentsCentre] components", self.components)

      // debugger;
      let visComps = [];

      let begin = centreBin;
      let end = centreBin;

      let sortedKeys = self.sortedComponentsKeys;

      let centreCompIndex = 1; // = sortedKeys.length>0 ? self.components.get(sortedKeys[Math.round(sortedKeys.length/2)]).index : 1;

      for (let i = 0; i < sortedKeys.length; i++) {
        if (sortedKeys[i] > centreBin) {
          centreCompIndex = i - 1;
          break;
        }
      }

      let curComp = self.components.get(sortedKeys[centreCompIndex]);

      let leftSpaceInCols =
        curComp.arrivals.size + (centreBin - curComp.firstBin + 1);
      let rightSpaceInCols =
        curComp.departures.size + (curComp.lastBin - centreBin);

      visComps.push(curComp.index);

      let counter = 1;

      while (
        leftSpaceInCols < self.columnsInView / 2 &&
        centreCompIndex - counter >= 0
      ) {
        curComp = self.components.get(sortedKeys[centreCompIndex - counter]);

        if (
          leftSpaceInCols + curComp.departures.size <
          self.columnsInView / 2
        ) {
          if (
            leftSpaceInCols + curComp.departures.size + curComp.numBins <=
            self.columnsInView / 2
          ) {
            leftSpaceInCols +=
              curComp.arrivals.size + curComp.numBins + curComp.departures.size;
          } else {
            let offset =
              leftSpaceInCols +
              curComp.departures.size +
              curComp.numBins -
              Math.round(self.columnsInView / 2);
            leftSpaceInCols +=
              curComp.numBins - offset + curComp.departures.size;
          }

          visComps.splice(0, 0, curComp.index);
        } else {
          curComp = self.components.get(
            sortedKeys[centreCompIndex - counter + 1]
          );
          break;
        }

        counter++;
      }

      if (leftSpaceInCols < self.columnsInView / 2) {
        rightSpaceInCols -= Math.round(
          self.columnsInView / 2 - leftSpaceInCols
        );
        begin = curComp.firstBin;
      } else if (leftSpaceInCols > self.columnsInView / 2) {
        if (leftSpaceInCols - curComp.arrivals.size < self.columnsInView / 2) {
          begin = curComp.firstBin;
        } else {
          begin =
            curComp.firstBin +
            (leftSpaceInCols -
              Math.round(self.columnsInView / 2) -
              curComp.arrivals.size);
        }
      } else {
        begin = curComp.firstBin;
      }

      counter = 1;

      while (
        rightSpaceInCols < self.columnsInView / 2 &&
        centreCompIndex + counter < sortedKeys.length
      ) {
        curComp = self.components.get(sortedKeys[centreCompIndex + counter]);

        if (rightSpaceInCols + curComp.arrivals.size < self.columnsInView / 2) {
          rightSpaceInCols +=
            curComp.arrivals.size + curComp.numBins + curComp.departures.size;

          visComps.push(curComp.index);
        } else {
          curComp = self.components.get(
            sortedKeys[centreCompIndex + counter - 1]
          );
          break;
        }

        counter++;
      }

      if (rightSpaceInCols < self.columnsInView / 2) {
        end = curComp.lastBin;
      } else if (rightSpaceInCols > self.columnsInView / 2) {
        if (
          rightSpaceInCols - curComp.departures.size <
          self.columnsInView / 2
        ) {
          end = curComp.lastBin;
        } else {
          end =
            curComp.lastBin +
            Math.ceil(
              rightSpaceInCols -
                self.columnsInView / 2 -
                curComp.departures.size
            );
        }
      } else {
        end = curComp.lastBin;
      }

      let relativePos = 0;

      visComps.forEach((item) => {
        let curComp = self.components.get(item);
        curComp.moveTo(relativePos * self.pixelsPerColumn);
        let arrivalSize = curComp.arrivals.size;
        let bodySize = curComp.numBins;

        if (relativePos == 0 && curComp.firstBin < begin) {
          arrivalSize = 0;
          bodySize = Math.round(curComp.lastBin - begin + 1);
        }
        relativePos += arrivalSize + bodySize + curComp.departures.size;
        self.visualisedComponents.set(item, item);
      });

      self.setBeginBin(begin);
      self.setEndBin(end);

      self.updatingVisible = false;
    },

    shiftVisualisedComponents() {
      // self.visualisedComponents.clear();
      // debugger;
      if (self.components.size === 0) {
        return;
      }
      // !!! When left component removed, arrival is removed as well ???
      // console.debug("[Store.shiftVisualisedComponents] components", self.components);

      let begin = self.getBeginBin;
      // let end = self.getEndBin;

      let visibleLengthInCols = 0;
      let lastCompDepartureSize = 0;

      let accountedComponents = [];

      if (self.visualisedComponents.size > 0) {
        let firstInView = self.firstVisualBin;

        if (begin < firstInView) {
          for (let index of self.sortedComponentsKeys) {
            if (self.visualisedComponents.has(index)) {
              break;
            }

            let comp = self.components.get(index);

            if (
              visibleLengthInCols + comp.departures.size < self.columnsInView &&
              comp.lastBin >= begin
            ) {
              self.visualisedComponents.set(comp.index, comp.index);
              accountedComponents.push(comp.index);
              comp.moveTo(visibleLengthInCols * self.pixelsPerColumn);
              lastCompDepartureSize = comp.departures.size;
              if (visibleLengthInCols === 0 && begin > comp.firstBin) {
                visibleLengthInCols +=
                  comp.lastBin - begin + 1 + comp.departures.size;
              } else {
                visibleLengthInCols +=
                  comp.arrivals.size + comp.numBins + comp.departures.size;
              }
            }

            if (visibleLengthInCols >= self.columnsInView) {
              break;
            }
          }
        }
      }
      let deleteTheRest = false;
      for (let index of self.sortedVisualComponentsKeys) {
        if (accountedComponents.includes(Number(index))) {
          continue;
        }
        let vComp = self.components.get(index);
        if (
          vComp.lastBin < begin ||
          visibleLengthInCols + vComp.arrivals.size >= self.columnsInView ||
          deleteTheRest
        ) {
          if (visibleLengthInCols + vComp.arrivals.size >= self.columnsInView) {
            deleteTheRest = true;
          }
          self.components.get(index).moveTo(-1);
          self.visualisedComponents.delete(index);
        } else {
          vComp.moveTo(visibleLengthInCols * self.pixelsPerColumn);
          lastCompDepartureSize = vComp.departures.size;
          if (vComp.firstBin < begin && vComp.lastBin >= begin) {
            visibleLengthInCols +=
              vComp.lastBin - begin + 1 + vComp.departures.size;
          } else {
            visibleLengthInCols +=
              vComp.arrivals.size + vComp.numBins + vComp.departures.size;
          }
        }
        // console.debug("[Store.shiftVisualisedComponents] deletion visibleLengthInCols", visibleLengthInCols);
      }

      if (visibleLengthInCols < self.columnsInView) {
        for (let index of self.sortedComponentsKeys) {
          let comp = self.components.get(index);

          if (
            visibleLengthInCols + comp.arrivals.size < self.columnsInView &&
            comp.lastBin >= begin &&
            !self.visualisedComponents.has(comp.index)
          ) {
            self.visualisedComponents.set(comp.index, comp.index);
            comp.moveTo(visibleLengthInCols * self.pixelsPerColumn);
            lastCompDepartureSize = comp.departures.size;
            if (visibleLengthInCols === 0 && begin > comp.firstBin) {
              visibleLengthInCols +=
                comp.lastBin - begin + 1 + comp.departures.size;
            } else {
              visibleLengthInCols +=
                comp.arrivals.size + comp.numBins + comp.departures.size;
            }
          } else if (
            visibleLengthInCols + comp.arrivals.size >=
            self.columnsInView
          ) {
            break;
          }

          if (visibleLengthInCols >= self.columnsInView) {
            break;
          }
        }
      }

      if (self.visualisedComponents.size > 0) {
        let end = self.lastVisualBin;

        if (visibleLengthInCols > self.columnsInView) {
          end -=
            visibleLengthInCols - self.columnsInView - lastCompDepartureSize;
        }

        self.setEndBin(end);
      }

      self.updatingVisible = false;
    },

    updateBeginEndBin(newBegin) {
      /*This method needs to be atomic to avoid spurious updates and out of date validation.*/

      // Need to handle zoom switch somehow.
      // debugger;
      // Sometimes, typing new bin, it arrives something that is not a valid integer
      self.updatingVisible = true;

      if (!isInt(newBegin)) {
        newBegin = 1;
        // newEnd = 100;
      }

      // TODO: manage a maxBeginBin based on the width of the last components in the pangenome
      newBegin = Math.min(
        self.last_bin_pangenome - 1,
        Math.max(1, Math.round(newBegin))
      );

      self.setBeginBin(newBegin);

      let sortedKeys = self.sortedComponentsKeys;

      if (sortedKeys.length > 0) {
        let firstBinInComponents = self.components.get(sortedKeys[0]).firstBin;
        let lastBinInComponents = self.components.get(
          sortedKeys[sortedKeys.length - 1]
        ).lastBin;

        if (lastBinInComponents <= newBegin) {
          self.clearComponents();
          promiseArray = self.shiftComponentsRight(
            Math.max(newBegin - self.columnsInView, 1),
            Math.min(
              newBegin + 2 * self.columnsInView,
              self.last_bin_pangenome
            ),
            false
          );

          Promise.all(promiseArray).then(() => {
            self.clearVisualisedComponents();
            self.shiftVisualisedComponents();
            promiseArray = undefined;
          });
        } else if (firstBinInComponents >= newBegin + self.columnsInView) {
          self.clearComponents();
          promiseArray = self.shiftComponentsRight(
            Math.max(newBegin - self.columnsInView, 1),
            Math.min(
              newBegin + 2 * self.columnsInView,
              self.last_bin_pangenome
            ),
            false
          );
          Promise.all(promiseArray).then(() => {
            self.clearVisualisedComponents();
            self.shiftVisualisedComponents();
            promiseArray = undefined;
          });
        } else {
          self.shiftVisualisedComponents();

          // This function is called 5 times every time the bin number is updated.
          // console.log("updateBeginEndBin - " + self.getBeginBin + " - " + self.getEndBin);

          // console.debug("[Store.updateBeginEndBin] columnInView", self.columnsInView);
          // console.debug("[Store.updateBeginEndBin] sortedKeys", sortedKeys);

          let visibleBinsNum = self.getEndBin - self.getBeginBin;

          // console.debug("[Store.updateBeginEndBin] first and last bins in components", firstBinInComponents,lastBinInComponents)
          // Change to bin size on screen.

          if (
            visibleBinsNum > lastBinInComponents - self.getEndBin &&
            lastBinInComponents < self.last_bin_pangenome
          ) {
            self.shiftComponentsRight(
              Math.max(self.getBeginBin - visibleBinsNum, 1),
              Math.min(self.getEndBin + visibleBinsNum, self.last_bin_pangenome)
            );
          }

          if (
            visibleBinsNum > self.getBeginBin - firstBinInComponents &&
            firstBinInComponents > 1
          ) {
            self.shiftComponentsLeft(
              Math.max(self.getBeginBin - visibleBinsNum, 1),
              Math.min(self.getEndBin + visibleBinsNum, self.last_bin_pangenome)
            );
          }
        }
      } else {
        self.shiftComponentsRight(
          1,
          Math.min(
            self.getBeginBin + 2 * self.columnsInView,
            self.last_bin_pangenome
          )
        );
      }
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
      let newPixInCol = checkAndForceMinOrMaxValue(
        Number(event.target.value),
        3,
        30
      );
      if (newPixInCol != self.pixelsPerColumn) {
        self.pixelsPerColumn = newPixInCol;
        self.updateBeginEndBin(self.getBeginBin);
      }
    },

    tryJSONpath(file) {
      const url =
        process.env.PUBLIC_URL + "/test_data/" + file + "/bin2file.json";
      if (urlExists(url)) {
        console.log("STEP#1: New Data Source: " + file);
        self.jsonName = file;
        self.loadIndexFile();
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

    setIndexSelectedZoomLevel(index) {
      // debugger;
      self.updatingVisible = false;
      let scaleFactor =
        self.availableZoomLevels[self.indexSelectedZoomLevel] /
        self.availableZoomLevels[index];

      // console.debug("[Store.setIndexSelectedZoomLevel] scaleFactor ",scaleFactor)

      let scaledBegin = Math.round((self.getBeginBin - 1) * scaleFactor) + 1;
      let scaledEnd = Math.round(self.getEndBin * scaleFactor);

      let centreBin = scaledBegin + Math.round((scaledEnd - scaledBegin) / 2);

      self.indexSelectedZoomLevel = index;

      let promiseArray = [];

      // self.clearVisualisedComponents();
      self.clearComponents();
      promiseArray = promiseArray.concat(
        self.shiftComponentsRight(
          Math.max(1, centreBin + 1),
          Math.min(
            centreBin + Math.round(self.columnsInView * 1.5),
            self.last_bin_pangenome
          ),
          false
        )
      );
      promiseArray = promiseArray.concat(
        self.shiftComponentsLeft(
          Math.max(1, centreBin - Math.round(self.columnsInView * 1.5)),
          Math.min(centreBin, self.last_bin_pangenome),
          false
        )
      );

      Promise.all(promiseArray).then(() => {
        self.shiftVisualisedComponentsCentre(centreBin);
        if (scaleFactor < 1) {
          self.setZoomHighlightBoundaries(scaledBegin, scaledEnd);
          setTimeout(() => {
            self.clearZoomHighlightBoundaries();
          }, 10000);
        }
      });
    },

    // setAvailableZoomLevels(availableZoomLevels) {
    //   // DEPRECATED: No need anymore. Available zoom levels are now extracted directly from the chunkIndex
    //   // let arr = [...availableZoomLevels];

    //   // self.availableZoomLevels = arr;
    // },

    setBeginBin(newBeginBin) {
      self.editingBeginBin = newBeginBin;
      self.beginBin = newBeginBin;
    },

    setEditingBeginBin(newBeginBin) {
      self.editingBeginBin = newBeginBin;
    },

    setEndBin(newEndBin) {
      self.endBin = newEndBin;
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

    // setLastBinPangenome(val) {
    //   self.last_bin_pangenome = val;
    // },

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
      return self.beginBin;
    },
    get getEndBin() {
      return self.endBin;
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
      return self.columnsInView * self.pixelsPerColumn;
    },
    get selectedZoomLevel() {
      //This is a genuinely useful getter
      let a = self.availableZoomLevels[self.indexSelectedZoomLevel];

      return a ? a : "1";
    },
    get last_bin_pangenome() {
      if (self.loading) {
        return 0;
      }

      return self.chunkIndex.zoom_levels.get(self.selectedZoomLevel).last_bin;
    },
    get columnsInView() {
      return Math.floor(self.windowWidth / self.pixelsPerColumn);
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
      return widthNav;
    },

    get matrixHeight() {
      return self.chunkIndex.pathNames.length * self.pixelsPerRow;
    },

    get sortedComponentsKeys() {
      let sortedKeys = keys(self.components);
      sortedKeys.sort((a, b) => {
        return Number(a) - Number(b);
      });

      return sortedKeys;
    },

    get sortedVisualComponentsKeys() {
      let sortedKeys = keys(self.visualisedComponents);
      sortedKeys.sort((a, b) => {
        return Number(a) - Number(b);
      });

      return sortedKeys;
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
    // Add getters for the first and last component and first and last visualised component.
  }));

export const store = RootStore.create({});
