import { types } from "mobx-state-tree";
import { entries, keys, values } from "mobx";
import { urlExists } from "./URL";
import {
  arraysEqual,
  checkAndForceMinOrMaxValue,
  isInt,
  argsort,
  findEqualBins,
  determineAdjacentIntersection,
} from "./utilities";

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
  annotation: types.array(types.string),
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
          annotation: bin[3],
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
    otherSideRight: types.boolean,
    elevation: types.optional(types.integer, 0),
    participants: types.array(types.integer),
  })
  .views((self) => ({
    get distance() {
      return Math.abs(self.downstream - self.upstream);
    },
  }));
// .views((self) => ({
//   get key() {
//     return (
//       String(this.downstream).padStart(13, "0") +
//       String(this.upstream).padStart(13, "0")
//     );
//   },
// }));

const Component = types
  .model({
    index: types.identifierNumber,
    // columnX: types.integer,
    // compressedColumnX: types.integer,
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
    occupants: types.array(types.integer),
    numBins: types.integer,
    matrix: types.map(ComponentMatrixElement),
    ends: types.array(types.integer),
    sequence: types.optional(types.string, ""),
  })
  .actions((self) => ({
    updateEnds(ends) {
      self.ends = ends;
    },
    addMatrixElement(matrixElement) {
      // CHANGE for INVERSION!!!
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
        // console.debug("[Component.addArrivalLinks]", link)

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
          key:
            keyPrefix +
            String(link.downstream).padStart(13, "0") +
            String(link.upstream).padStart(13, "0") +
            (link.otherSideRight ? "osr" : "osl"),
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
        // console.debug("[Component.addArrivalLinks]", link)
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
        // i++;
      }
    },

    moveTo(newRelativePixelX, windowWidth, pixelsPerColumn) {
      self.relativePixelX = newRelativePixelX;
      self.departureVisible = true;
      if (windowWidth && pixelsPerColumn) {
        if (
          windowWidth <
          self.relativePixelX +
            (self.leftLinkSize + self.numBins + self.rightLinkSize - 1) *
              pixelsPerColumn
        ) {
          self.departureVisible = false;
        }
      }
    },

    getColumnX(useWidthCompression) {
      return useWidthCompression ? self.compressedColumnX : self.columnX;
    },
  }))
  .views((self) => ({
    // get connectorLink() {
    //   for (let link of values(self.departures)) {
    //     if (Number(link.upstream) + 1 === Number(link.downstream)) {
    //       return link;
    //     }
    //   }

    //   return null;
    // },
    get leftLinkSize() {
      return self.ldepartures.size + self.larrivals.size;
    },

    get rightLinkSize() {
      return self.farRightDepartures.size + self.farRightArrivals.size + 1;

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

const Chunk = types.model({
  file: types.string,
  fasta: types.maybeNull(types.string),
  first_bin: types.integer,
  first_col: types.integer,
  last_bin: types.integer,
  last_col: types.integer,
  // x: types.integer,
  // compressedX: types.integer,
});
const ZoomLevel = types.model({
  // bin_width: types.integer,
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

const searchTermsStruct = types.model({
  path: types.string,
  searchGenes: types.boolean,
  search: types.string,
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
    // nucleotides: types.array(types.string), // nucleotides attribute and its edges

    // this.metadata = []; This will be used later to store annotation possibly.

    chunkIndex: types.maybeNull(ChunkIndex),
    beginBin: types.optional(types.integer, 1),
    editingBeginBin: types.optional(types.integer, 1),
    editingPixelsPerColumn: types.optional(types.integer, 10),
    editingPixelsPerRow: types.optional(types.integer, 1),
    endBin: types.optional(types.integer, 1),
    useVerticalCompression: false,
    useWidthCompression: false,
    binScalingFactor: 3,
    useConnector: true,
    pixelsPerColumn: 10,
    pixelsPerRow: 10,
    heightNavigationBar: 25,
    leftOffset: 1,
    maxArrowHeight: types.optional(types.integer, 0),
    highlightedLink: types.maybeNull(types.array(types.integer)), // we will compare linkColumns
    // selectedLink: types.maybeNull(types.reference(LinkColumn)),
    // Do we actually need selectedLink or should we use highlighted link even
    // if we jump? Just use setTimeout to clear it after some time.
    cellToolTipContent: "",
    // jsonName: "AT_Chr1_OGOnly_2.1_new",
    // jsonName: "coregraph_genes_f2.1_Ref_v04_new",
    jsonName: "testCollapse_new",

    // jsonName: "coregraph_genes",

    // Added attributes for the zoom level management
    // availableZoomLevels: types.optional(types.array(types.string), ["1"]),

    scaleFactor: 1,
    indexSelectedZoomLevel: 0,

    chunkURLs: types.optional(types.array(types.string), []),
    chunkFastaURLs: types.optional(types.array(types.string), []),
    //to be compared against chunkURLs
    chunksProcessed: types.optional(types.array(types.string), []),
    chunksProcessedFasta: types.optional(types.array(types.string), []),

    searchTerms: types.optional(searchTermsStruct, {
      path: "",
      searchGenes: true,
      search: "",
    }), // OR: types.maybe(PathNucPos)
    pathIndexServerAddress: "http://localhost:5000", // "http://193.196.29.24:3010/",

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
    hideInversionLinks: true,
  })
  .actions((self) => ({
    // updateHighlightedLink(link) {
    //   self.highlightedLink = link.key;
    // },

    // jumpLink(link) {},

    toggleHideInversionLinks() {
      self.hideInversionLinks = !self.hideInversionLinks;
    },

    updateMouse(x, y) {
      self.mouseX = x;
      self.mouseY = y;
    },

    updateWindow(windowWidth) {
      self.windowWidth = windowWidth;
      self.updateBeginEndBin(self.getBeginBin);
    },

    addComponent(component, seq) {
      // Component index by first zoom
      let curComp = Component.create({
        // columnX: component.x,
        // compressedColumnX: component.compressedX,

        index: component.first_bin,
        firstBin: component.first_bin,
        lastBin: component.last_bin,

        firstCol: component.firstCol,
        lastCol: component.lastCol,

        relativePixelX: -1,

        // deep copy of occupants
        occupants: component.occupants,
        numBins: component.last_bin - component.first_bin + 1,
        sequence: seq,
      });
      // console.debug("[Store.addComponent]",component )
      curComp.updateEnds(component.ends);
      curComp.addMatrixElements(component.matrix);
      let dbg = false;
      // if (curComp.firstBin === 123) {
      //   dbg = true;
      // }

      curComp.addLeftLinks(component.ldepartures, component.larrivals, dbg);
      curComp.addRightLinks(component.rdepartures, component.rarrivals, dbg);
      // console.debug("[Store.addComponent]",curComp);
      self.components.set(curComp.index, curComp);
    },

    addComponents(compArray, nucleotides = [], fromRight = true) {
      // console.debug("[Store.addComponents] compArray", compArray);
      // console.debug("[Store.addComponents] nucleotides", nucleotides);
      // console.debug("[Store.addComponents] fromRight", fromRight);

      let splicing = 0;

      if (compArray[0].first_bin === 0) {
        splicing = 1;
      }
      let offset = compArray[splicing].first_bin;

      if (!fromRight) {
        compArray.reverse();
      }
      console.debug("[Store.addComponents] compArray", compArray);
      console.debug("[Store.addComponents] nucleotides", nucleotides);

      for (const component of compArray.splice(splicing)) {
        if (!self.components.has(component.first_bin)) {
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

    // addNucleotideSequence(sequence, fromRight) {
    //   // console.debug("[Store.addNucleotideSequence] sequence", sequence);
    //   // console.debug("[Store.addNucleotideSequence] fromRight", fromRight);

    //   if (fromRight) {
    //     self.nucleotides.splice(self.nucleotides.length, 0, ...sequence);
    //   } else {
    //     self.nucleotides.splice(0, 0, ...sequence);
    //   }
    // },

    addNucleotidesFromFasta(url) {
      // console.debug("[Store.addNucleotidesFromFasta] url", url);

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

    shiftComponentsRight(
      windowStart,
      windowEnd,
      byCols = false,
      doClean = true
    ) {
      // console.debug(
      //   "[Store.shiftComponentsRight] component store before removal",
      //   self.components
      // );
      // console.debug(
      //   "[Store.shiftComponentsRight] windowStart windowEnd",
      //   windowStart,
      //   windowEnd
      // );
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

        if (byCols) {
          lastBin = Array.from(
            self.components.values(),
            (comp) => comp.lastCol
          ).pop();
        } else {
          lastBin = Array.from(
            self.components.values(),
            (comp) => comp.lastBin
          ).pop();
        }

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
        let loadChunk;
        if (byCols) {
          loadChunk =
            lastBin < chunkFile.last_col &&
            (windowEnd - chunkFile.first_col) *
              (chunkFile.last_col - windowStart) >=
              0;
        } else {
          loadChunk =
            lastBin < chunkFile.last_bin &&
            (windowEnd - chunkFile.first_bin) *
              (chunkFile.last_bin - windowStart) >=
              0;
        }
        if (loadChunk) {
          if (
            (self.getEndBin - chunkFile.first_bin) *
              (chunkFile.last_bin - self.getBeginBin) >=
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

      if (doUpdateVisual && doClean && !byCols) {
        Promise.all(promiseArray).then((values) => {
          self.shiftVisualisedComponents();
        });
      }
      if (!doClean) {
        return promiseArray;
      }
    },

    shiftComponentsLeft(
      windowStart,
      windowEnd,
      byCols = false,
      doClean = true
    ) {
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
        if (byCols) {
          firstBin = self.components.values().next().value.firstCol;
        } else {
          firstBin = self.components.values().next().value.firstBin;
        }
        firstBin = firstBin ? firstBin : 0;
      }

      let doUpdateVisual = false;
      promiseArray = [];

      for (let chunkFile of self.chunkIndex.zoom_levels.get(
        self.selectedZoomLevel
      ).files) {
        let loadChunk;
        if (byCols) {
          loadChunk =
            firstBin > chunkFile.first_col &&
            (windowEnd - chunkFile.first_col) *
              (chunkFile.last_col - windowStart) >=
              0;
        } else {
          loadChunk =
            firstBin > chunkFile.first_bin &&
            (windowEnd - chunkFile.first_bin) *
              (chunkFile.last_bin - windowStart) >=
              0;
        }
        if (loadChunk) {
          if (
            (self.getEndBin - chunkFile.first_bin) *
              (chunkFile.last_bin - self.getBeginBin) >=
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
      // console.debug("[Store.clearComponents]");
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
      self.clearComponents();
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
      self.indexSelectedZoomLevel = 0;
      self.chunkIndex = null; // Needed to clear out the reference. Otherwise previos and new chunks can potentially mix.

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

    calcLinkElevations() {
      let visibleLinks = [];

      for (let comp of values(self.visualisedComponents)) {
        if (comp.lastBin <= self.getEndBin && comp.departureVisible) {
          for (let link of values(comp.rdepartures)) {
            let dComp = self.linkInView(link.downstream);
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
            let dComp = self.linkInView(link.downstream);
            let invertedArrival = link.key.slice(link.key.length - 3) === "osr";
            if (dComp) {
              // let invertedArrival;
              // if (dComp.larrivals.has("a" + link.key.slice(1,link.key.length-3) + (link.side=='right'?'osr':'osl'))) {
              //   invertedArrival = false;
              // } else {
              //   invertedArrival = true;
              // }
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

        // if (curLinkIdx == 2) {
        //   debugger;
        // }

        // if (curLink.downstream===123 || prevLink.downstream==123) {
        //   debugger;
        // }

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
        // if (visibleLinks[curLinkIdx].link.upstream===121 || visibleLinks[curLinkIdx].link.upstream === 122) {
        //   debugger;
        // }
        let existingElevations = new Set();
        for (let prevLinkIdx = 0; prevLinkIdx < curLinkIdx; prevLinkIdx++) {
          if (isIntersecting(curLinkIdx, prevLinkIdx)) {
            existingElevations.add(visibleLinks[prevLinkIdx].link.elevation);
            // visibleLinks[curLinkIdx].link.elevation = Math.max(
            //   visibleLinks[curLinkIdx].link.elevation,
            //   visibleLinks[prevLinkIdx].link.elevation+ 1
            // );
            // if (visibleLinks[curLinkIdx].link.elevation>3) {debugger;}
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
      // debugger;
    },

    shiftVisualisedComponentsCentre(centreBin, centreCol, highlight = false) {
      // console.debug("[Store.shiftVisualisedComponentsCentre] centreBin", centreBin)
      console.debug(
        "[Store.shiftVisualisedComponentsCentre] highlight",
        highlight
      );

      let visComps = [];
      self.maxArrowHeight = 0;

      let begin = centreBin;
      let end = centreBin;

      let sortedKeys = self.sortedComponentsKeys;

      let centreCompIndex = sortedKeys.length - 1; // = sortedKeys.length>0 ? self.components.get(sortedKeys[Math.round(sortedKeys.length/2)]).index : 1;

      if (centreCol) {
        // debugger;
        for (let i = 0; i < sortedKeys.length; i++) {
          let tComp = self.components.get(sortedKeys[i]);
          if (tComp.firstCol <= centreCol && tComp.lastCol >= centreCol) {
            centreCompIndex = i;
            let distRatio =
              (centreCol - tComp.firstCol) / (tComp.lastCol - tComp.firstCol);
            centreBin =
              tComp.firstBin +
              Math.floor(distRatio * (tComp.lastBin - tComp.firstBin));
            break;
          }
        }
      } else {
        for (let i = 0; i < sortedKeys.length; i++) {
          if (sortedKeys[i] > centreBin) {
            centreCompIndex = i - 1;
            break;
          }
        }
      }
      let curComp = self.components.get(sortedKeys[centreCompIndex]);

      if (curComp == undefined) {
        debugger;
      }

      let leftSpaceInCols =
        curComp.leftLinkSize + (centreBin - curComp.firstBin + 1);
      let rightSpaceInCols =
        curComp.rightLinkSize + (curComp.lastBin - centreBin);

      visComps.push(curComp.index);

      let counter = 1;

      while (
        leftSpaceInCols < self.columnsInView / 2 &&
        centreCompIndex - counter >= 0
      ) {
        curComp = self.components.get(sortedKeys[centreCompIndex - counter]);

        if (leftSpaceInCols + curComp.rightLinkSize < self.columnsInView / 2) {
          // if (
          //   leftSpaceInCols + curComp.rightLinkSize + curComp.numBins <=
          //   self.columnsInView / 2
          // ) {
          leftSpaceInCols +=
            curComp.leftLinkSize + curComp.numBins + curComp.rightLinkSize;
          // } else {
          //   let offset =
          //     leftSpaceInCols +
          //     curComp.rightLinkSize +
          //     curComp.numBins -
          //     Math.round(self.columnsInView / 2);
          //   leftSpaceInCols += curComp.numBins - offset + curComp.rightLinkSize;
          // }

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
        begin =
          curComp.firstBin +
          Math.ceil(
            leftSpaceInCols - self.columnsInView / 2 - curComp.leftLinkSize
          );
      } else {
        begin = curComp.firstBin;
      }

      if (leftSpaceInCols > self.columnsInView / 2) {
        leftSpaceInCols = self.columnsInView / 2;
      }

      counter = 1;

      let rightFilled = false;

      while (
        rightSpaceInCols < self.columnsInView / 2 &&
        centreCompIndex + counter < sortedKeys.length
      ) {
        rightFilled = true;
        curComp = self.components.get(sortedKeys[centreCompIndex + counter]);

        if (rightSpaceInCols + curComp.leftLinkSize < self.columnsInView / 2) {
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

      if (rightSpaceInCols < self.columnsInView / 2) {
        end = curComp.lastBin;
      } else {
        if (rightSpaceInCols - curComp.rightLinkSize < self.columnsInView / 2) {
          end = curComp.lastBin;
        } else {
          end =
            curComp.lastBin -
            Math.max(
              0,
              Math.ceil(
                rightSpaceInCols -
                  curComp.rightLinkSize -
                  self.columnsInView / 2
              )
            );
        }
      }
      // } else {
      //   end = curComp.lastBin;
      // }

      let relativePos = 0;

      visComps.forEach((item) => {
        let curComp = self.components.get(item);
        curComp.moveTo(
          relativePos * self.pixelsPerColumn,
          self.windowWidth,
          self.pixelsPerColumn
        );
        let leftSize = curComp.leftLinkSize;
        let bodySize = curComp.numBins;

        if (relativePos == 0 && curComp.firstBin < begin) {
          leftSize = 0;
          bodySize = Math.round(curComp.lastBin - begin + 1);
        }
        relativePos += leftSize + bodySize + curComp.rightLinkSize;
        self.visualisedComponents.set(item, item);
      });

      self.setBeginBin(begin);
      self.setEndBin(end);
      self.calcLinkElevations();
      if (highlight) {
        let comp = self.visibleCompByBin(centreBin);
        self.addToSelection(comp.firstCol, comp.lastCol);
      }

      self.updatingVisible = false;
    },

    shiftVisualisedComponents(highlight = false) {
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
              visibleLengthInCols + comp.rightLinkSize < self.columnsInView &&
              comp.lastBin >= begin
            ) {
              self.visualisedComponents.set(comp.index, comp.index);
              accountedComponents.push(comp.index);
              comp.moveTo(
                visibleLengthInCols * self.pixelsPerColumn,
                self.windowWidth,
                self.pixelsPerColumn
              );
              lastCompDepartureSize = comp.rightLinkSize;
              if (visibleLengthInCols === 0 && begin > comp.firstBin) {
                visibleLengthInCols +=
                  comp.lastBin - begin + 1 + comp.rightLinkSize;
              } else {
                visibleLengthInCols +=
                  comp.leftLinkSize + comp.numBins + comp.rightLinkSize;
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
          visibleLengthInCols + vComp.leftLinkSize >= self.columnsInView ||
          deleteTheRest
        ) {
          if (visibleLengthInCols + vComp.leftLinkSize >= self.columnsInView) {
            deleteTheRest = true;
          }
          self.components.get(index).moveTo(-1);
          self.visualisedComponents.delete(index);
        } else {
          vComp.moveTo(
            visibleLengthInCols * self.pixelsPerColumn,
            self.windowWidth,
            self.pixelsPerColumn
          );
          lastCompDepartureSize = vComp.rightLinkSize;
          if (vComp.firstBin < begin && vComp.lastBin >= begin) {
            visibleLengthInCols +=
              vComp.lastBin - begin + 1 + vComp.rightLinkSize;
          } else {
            visibleLengthInCols +=
              vComp.leftLinkSize + vComp.numBins + vComp.rightLinkSize;
          }
        }
        // console.debug("[Store.shiftVisualisedComponents] deletion visibleLengthInCols", visibleLengthInCols);
      }

      if (visibleLengthInCols < self.columnsInView) {
        for (let index of self.sortedComponentsKeys) {
          let comp = self.components.get(index);

          if (
            comp.lastBin >= begin &&
            !self.visualisedComponents.has(comp.index)
          ) {
            if (visibleLengthInCols + comp.leftLinkSize < self.columnsInView) {
              self.visualisedComponents.set(comp.index, comp.index);
              comp.moveTo(
                visibleLengthInCols * self.pixelsPerColumn,
                self.windowWidth,
                self.pixelsPerColumn
              );
              lastCompDepartureSize = comp.rightLinkSize;
              if (visibleLengthInCols === 0 && begin > comp.firstBin) {
                visibleLengthInCols +=
                  comp.lastBin - begin + 1 + comp.rightLinkSize;
              } else {
                visibleLengthInCols +=
                  comp.leftLinkSize + comp.numBins + comp.rightLinkSize;
              }
            } else if (
              visibleLengthInCols + comp.leftLinkSize >=
              self.columnsInView
            ) {
              break;
            }
          }

          if (visibleLengthInCols >= self.columnsInView) {
            break;
          }
        }
      }

      if (self.visualisedComponents.size > 0) {
        let end = self.lastVisualBin;

        if (visibleLengthInCols > self.columnsInView) {
          end -= Math.max(
            0,
            visibleLengthInCols - self.columnsInView - lastCompDepartureSize
          );
        }

        self.setEndBin(end);
      }

      self.calcLinkElevations();
      if (highlight) {
        let comp = self.visibleCompByBin(self.getBeginBin);
        self.addToSelection(comp.firstCol, comp.lastCol);
      }

      self.updatingVisible = false;
    },

    updateBeginEndBin(newBegin, highlight = false) {
      /*This method needs to be atomic to avoid spurious updates and out of date validation.*/

      // Need to handle zoom switch somehow.
      // debugger;
      // Sometimes, typing new bin, it arrives something that is not a valid integer
      self.updatingVisible = true;
      self.updateHighlightedLink(null);

      if (!isInt(newBegin)) {
        newBegin = 1;
        // newEnd = 100;
      }

      // TODO: manage a maxBeginBin based on the width of the last components in the pangenome
      newBegin = Math.min(
        self.last_bin_pangenome - 1,
        Math.max(1, Math.round(newBegin))
      );

      let sortedKeys = self.sortedComponentsKeys;

      if (sortedKeys.length > 0) {
        let firstBinInComponents = self.components.get(sortedKeys[0]).firstBin;
        let lastBinInComponents = self.components.get(
          sortedKeys[sortedKeys.length - 1]
        ).lastBin;

        if (lastBinInComponents <= newBegin + self.columnsInView) {
          self.clearComponents();
          self.setBeginBin(newBegin);
          promiseArray = self.shiftComponentsRight(
            Math.max(newBegin - self.columnsInView, 1),
            Math.min(
              newBegin + 2 * self.columnsInView,
              self.last_bin_pangenome
            ),
            false,
            false
          );

          Promise.all(promiseArray).then(() => {
            // self.clearVisualisedComponents();
            self.shiftVisualisedComponents(highlight);
            promiseArray = undefined;
          });
        } else if (firstBinInComponents >= newBegin) {
          self.clearComponents();
          self.setBeginBin(newBegin);
          promiseArray = self.shiftComponentsRight(
            Math.max(newBegin - self.columnsInView, 1),
            Math.min(
              newBegin + 2 * self.columnsInView,
              self.last_bin_pangenome
            ),
            false,
            false
          );
          Promise.all(promiseArray).then(() => {
            // self.clearVisualisedComponents();
            self.shiftVisualisedComponents(highlight);
            promiseArray = undefined;
          });
        } else {
          self.setBeginBin(newBegin);
          self.shiftVisualisedComponents(highlight);

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
        self.setBeginBin(newBegin);
        self.shiftComponentsRight(
          1,
          Math.min(
            self.getBeginBin + 2 * self.columnsInView,
            self.last_bin_pangenome
          )
        );
      }
    },

    jumpToCentre(
      centreBin,
      moveToRight,
      highlightedLink = null,
      marker = false,
      highlight = false
    ) {
      console.debug("[Store.jumpToCentre] highlight", highlight);
      self.updatingVisible = true;
      let promiseArray = [];

      if (centreBin >= self.firstLoadedBin && centreBin <= self.lastLoadedBin) {
        if (moveToRight === 1) {
          //Arrow to the right
          promiseArray = promiseArray.concat(
            self.shiftComponentsRight(
              Math.max(1, centreBin - Math.round(self.columnsInView * 1.5)),
              Math.min(
                centreBin + Math.round(self.columnsInView * 1.5),
                self.last_bin_pangenome
              )
            )
          );
        } else if (moveToRight === -1) {
          //Arrow to the left
          promiseArray = promiseArray.concat(
            self.shiftComponentsLeft(
              Math.max(1, centreBin - Math.round(self.columnsInView * 1.5)),
              Math.min(
                centreBin + Math.round(self.columnsInView * 1.5),
                self.last_bin_pangenome
              )
            )
          );
        } else {
          // Self loop on single bin component
          // do nothing with loaded components.
        }
      } else {
        self.clearComponents();
        promiseArray = promiseArray.concat(
          self.shiftComponentsRight(
            Math.max(1, centreBin + 1),
            Math.min(
              centreBin + Math.round(self.columnsInView * 1.5),
              self.last_bin_pangenome
            ),
            false,
            false
          )
        );
        promiseArray = promiseArray.concat(
          self.shiftComponentsLeft(
            Math.max(1, centreBin - Math.round(self.columnsInView * 1.5)),
            Math.min(centreBin, self.last_bin_pangenome),
            false,
            false
          )
        );
      }

      self.updateHighlightedLink(highlightedLink);

      Promise.all(promiseArray).then(() => {
        self.clearVisualisedComponents();
        self.shiftVisualisedComponentsCentre(centreBin, undefined, highlight);
      });
      setTimeout(() => {
        self.updateHighlightedLink(null);
      }, 5000);

      if (marker) {
        self.setZoomHighlightBoundaries(
          self.visibleColFromBin(centreBin),
          self.visibleColFromBin(centreBin)
        );
        setTimeout(() => {
          self.clearZoomHighlightBoundaries();
        }, 10000);
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
      if (linkRect) {
        if (linkRect instanceof Array) {
          self.highlightedLink = [linkRect[0], linkRect[1]];
        } else {
          self.highlightedLink = [linkRect.upstream, linkRect.downstream];
        }
      } else {
        self.highlightedLink = null;
      }
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

    // updateEditingHeight(event) {
    //   self.editingPixelsPerRow = checkAndForceMinOrMaxValue(
    //     Number(event.target.value),
    //     1,
    //     30
    //   );
    // },

    updateWidth(value) {
      let newPixInCol = checkAndForceMinOrMaxValue(Number(value), 3, 30);
      if (newPixInCol != self.pixelsPerColumn) {
        self.pixelsPerColumn = newPixInCol;
        self.updateBeginEndBin(self.getBeginBin);
      }
      self.editingPixelsPerColumn = newPixInCol;
    },

    updateEditingWidth(value) {
      self.editingPixelsPerColumn = Number(value);
    },

    tryJSONpath(file) {
      const url =
        process.env.PUBLIC_URL + "/test_data/" + file + "/bin2file.json";
      if (urlExists(url)) {
        console.log("STEP#1: New Data Source: " + file);
        self.jsonName = file;
        self.loadIndexFile().then(() => {
          self.updateBeginEndBin(1);
        });
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
      self.updatingVisible = true;
      let scaleFactor =
        self.availableZoomLevels[self.indexSelectedZoomLevel] /
        self.availableZoomLevels[index];
      let newZoomLevel = parseInt(self.availableZoomLevels[index]);
      // console.debug("[Store.setIndexSelectedZoomLevel] scaleFactor ",scaleFactor)

      // Calculating the first column of the begin, central and end bin.
      // It will make it easier to find proper centre and edges on the other zoom level.

      let centralColumn = self.visibleColFromBin(self.centreBin);
      let leftColumn = self.visibleColFromBin(self.beginBin);
      let rightColumn = self.visibleColFromBin(self.endBin);

      let scaledBegin = Math.round((self.getBeginBin - 1) * scaleFactor) + 1;
      let scaledEnd = Math.round(self.getEndBin * scaleFactor);

      let centreBin = scaledBegin + Math.round((scaledEnd - scaledBegin) / 2);

      self.indexSelectedZoomLevel = index;

      let promiseArray = [];

      // self.clearVisualisedComponents();
      self.clearComponents();
      promiseArray = promiseArray.concat(
        self.shiftComponentsRight(
          Math.max(1, centralColumn + 1),
          Math.min(
            centralColumn + Math.round(self.columnsInView * newZoomLevel * 1.5),
            self.last_col_pangenome
          ),
          true,
          false
        )
      );
      promiseArray = promiseArray.concat(
        self.shiftComponentsLeft(
          Math.max(
            1,
            centralColumn - Math.round(self.columnsInView * newZoomLevel * 1.5)
          ),
          Math.min(centralColumn, self.last_col_pangenome),
          true,
          false
        )
      );

      Promise.all(promiseArray).then(() => {
        self.shiftVisualisedComponentsCentre(centreBin, centralColumn);
        if (scaleFactor < 1) {
          // console.debug(
          //   `[Store.setIndexSelectedZoomLevel] zoomHighlightBegin: ${scaledBegin} zoomHighlightEnd: ${scaledEnd}`
          // );
          self.setZoomHighlightBoundaries(leftColumn, rightColumn);
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

    updateSearchTerms(path, searchGenes, search) {
      //console.log('updatePathNucPos: ' + path + ' --- ' + nucPos)

      console.debug("[Store.updateSearchTerms] path", path);
      console.debug("[Store.updateSearchTerms] searchGenes", searchGenes);
      console.debug("[Store.updateSearchTerms] search", search);

      if (path !== undefined) {
        self.searchTerms.path = path;
      }

      if (search !== undefined) {
        self.searchTerms.searchGenes = searchGenes;
      }

      if (searchGenes !== undefined) {
        self.searchTerms.search = search;
      }
    },

    setLoading(val) {
      self.loading = val;
      self.updatingVisible = true;
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
    get centreBin() {
      return Math.round((self.getBeginBin + self.getEndBin) / 2);
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
      if (self.loading) {
        return 0;
      }

      return self.chunkIndex.zoom_levels.get(self.selectedZoomLevel).last_bin;
    },

    get last_col_pangenome() {
      if (self.loading) {
        return 0;
      }

      return self.chunkIndex.zoom_levels.get(self.selectedZoomLevel).last_col;
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

      if (self.getEndBin > self.getEndBin) {
        widthNav = 1;
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
    get topOffset() {
      let res = self.heightNavigationBar + self.maxArrowHeight;

      return res;
    },

    linkInView(bin) {
      return values(self.visualisedComponents).find((comp) => {
        return (
          (comp.lastBin === bin && self.getEndBin >= comp.lastBin) ||
          (comp.firstBin === bin && self.getBeginBin <= comp.firstBin)
        );
      });
    },
    visibleCompByBin(bin) {
      return values(self.visualisedComponents).find((comp) => {
        return comp.lastBin >= bin && comp.firstBin <= bin;
      });
    },
    visibleColFromBin(bin) {
      let comp = self.visibleCompByBin(bin);
      let distRatio =
        (bin - comp.firstBin + 1) / (comp.lastBin - comp.firstBin + 1);
      let col =
        comp.firstCol -
        1 +
        Math.round(distRatio * (comp.lastCol - comp.firstCol));

      return col;
    },
    // get arrowHeight() {
    //   let res = 5;
    //   if (self.heightArray.length > 0) {
    //     res += Math.max(...self.heightArray);
    //   }
    //   return res;
    // },
  }));

export const store = RootStore.create({});
