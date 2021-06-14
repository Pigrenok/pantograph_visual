import { Layer, Stage, Text, Rect, Arrow } from "react-konva";
import React, { Component } from "react";

import "./App.css";
import PangenomeSchematic from "./PangenomeSchematic";
import ComponentRect, { compress_visible_rows } from "./ComponentRect";
import ComponentNucleotides from "./ComponentNucleotides";
import LinkColumn from "./LinkColumn";
import LinkArrow from "./LinkArrow";
import { calculateLinkCoordinates } from "./LinkRecord";
import NucleotideTooltip from "./NucleotideTooltip";
import ControlHeader from "./ControlHeader";
import { observe, keys, values } from "mobx";
import { observer } from "mobx-react";
import { arraysEqual, calculateEndBinFromScreen } from "./utilities";

//import makeInspectable from "mobx-devtools-mst";
// TO_DO: improve the management of visualized components
let index_to_component_to_visualize_dict;

function Legend() {
  return (
    <img
      src={process.env.PUBLIC_URL + "/Schematize legend.gif"}
      alt="legend"
      style={{
        position: "fixed",
        bottom: "20px",
        left: "20px",
        background: "white",
        align: "right",
        width: "100px",
        height: "200px",
      }}
    />
  );
}

const App = observer(
  class extends Component {
    layerRef = React.createRef();
    layerRef2 = React.createRef();
    layerNavigationBar = React.createRef();

    // Timer for the LinkArrow highlighting and selection (clicking on it)
    timerHighlightingLink = null;
    timerSelectionLink = null;

    constructor(props) {
      console.debug("[App.constructor] app being constructed");

      super(props);

      // this.state = {
      //   schematize: [],
      //   pathNames: [],
      //   actualWidth: 1,
      //   buttonsHeight: 0,
      // };
      // this.schematic = new PangenomeSchematic({ store: this.props.store }); //Read file, parse nothing
      this.props.store.loadIndexFile().then(() => {
        this.props.store.updateWindow(window.innerWidth);
        window.addEventListener("resize", () =>
          this.props.store.updateWindow(window.innerWidth)
        );
      });
      // console.debug("[App.constructor]",this.props.store.components)

      /* == State control flow --> redundancies here can waste processing time
      * STEP #1: whenever jsonName changes, loadIndexFile
      * STEP #2: chunkIndex contents loaded
      * STEP #3: with new chunkIndex, this.openRelevantChunksFromIndex()
      * STEP #4: Set switchChunkURLs
      * STEP #5: once ChunkURLs are listed, go fetchAllChunks
      * STEP #6: fetched chunks go into loadJsonCache
      * STEP #7: JsonCache causes processArray to update chunksProcessed
      * STEP #8: chunksProcessed finishing triggers updateSchematicMetadata with final rendering info for this loaded chunks
        * STEP #9: reserveAirspace
        * STEP #10: calcMaxNumRowsAcrossComponents
      //TODO: separate processArray into its  own observer
      * STEP #11: Y values calculated, trigger do the render
      * */

      //Arrays must be observed directly, simple objects are observed by name
      //STEP #5: once ChunkURLs are listed, go fetchAllChunks
      // observe(this.props.store.chunkURLs, this.fetchAllChunks.bind(this));

      // observe(
      //   this.props.store,
      //   "useVerticalCompression",
      //   this.updateSchematicMetadata.bind(this)
      // );
      // observe(
      //   this.props.store,
      //   "useWidthCompression",
      //   this.openRelevantChunksFromIndex.bind(this)
      // );
      // //observe(this.props.store, "colorByGeneAnnotation", this.recalcY.bind(this));

      // observe(this.props.store, "useConnector", this.recalcXLayout.bind(this)); //TODO faster rerender

      // observe(
      //   this.props.store,
      //   "pixelsPerColumn",
      //   this.openRelevantChunksFromIndex.bind(this)
      // ); //TODO faster rerender
      // observe(this.props.store, "pixelsPerRow", this.recalcY.bind(this)); //TODO faster rerender

      // //STEP #8: chunksProcessed finishing triggers updateSchematicMetadata with final
      // // rendering info for this loaded chunks
      // observe(
      //   this.props.store.chunksProcessed,
      //   this.updateSchematicMetadata.bind(this)
      // );
      // observe(
      //   this.props.store.chunksProcessedFasta,
      //   this.updateSchematicMetadata.bind(this)
      // );

      // //STEP #11: Y values calculated, trigger do the render
      // observe(this.props.store, "loading", this.render.bind(this));

      // //STEP #3: with new chunkIndex, openRelevantChunksFromIndex
      // observe(
      //   this.props.store,
      //   "chunkIndex",
      //   this.openRelevantChunksFromIndex.bind(this)
      // );

      // observe(
      //   this.props.store,
      //   "indexSelectedZoomLevel",
      //   this.openRelevantChunksFromIndex.bind(this) // Whenever the selected zoom level changes
      // );
      // observe(
      //   this.props.store.beginEndBin, //user moves start position
      //   //This following part is important to scroll right and left on browser
      //   () => {
      //     console.log(
      //       "Updated Begin and End bin: " + this.props.store.beginEndBin
      //     );
      //     this.openRelevantChunksFromIndex();
      //   }
      // );

      // For debugging purposes
      //makeInspectable(this.props.store);
    }

    prepareWhichComponentsToVisualize(widthInColumns) {
      //console.log("prepareWhichComponentsToVisualize: widthInColumns --> " + widthInColumns);

      // It prepares a dictionary with the components to visualize. It is improvable putting all the components
      // in a dictionary (this.schematic.components becames a dictionary).

      index_to_component_to_visualize_dict = {};

      const beginBin = this.props.store.getBeginBin;
      let newEndBin = this.props.store.getEndBin;

      let firstFieldX = -1;

      for (const schematizeComponent of this.schematic.components) {
        if (schematizeComponent.lastBin >= beginBin) {
          const fieldX = schematizeComponent.getColumnX(
            this.props.store.useWidthCompression
          );

          if (firstFieldX === -1) {
            firstFieldX = fieldX;

            // The first component can be partially visualized
            widthInColumns += this._column_shift(schematizeComponent);
          }

          /*console.log("fieldX: " + fieldX);
          console.log('fieldX - firstFieldX: ' + (fieldX - firstFieldX))
          console.log("schematizeComponent.lastBin: " + schematizeComponent.lastBin);*/

          // If the new component is outside the windows, the preparation is over
          // TO_DO: take into account the shifted columns in the normal visualization mode (rearrangements + full components)
          if (fieldX - firstFieldX >= widthInColumns) {
            break;
          }

          index_to_component_to_visualize_dict[
            schematizeComponent.index
          ] = schematizeComponent;

          newEndBin = schematizeComponent.lastBin;
        }

        //console.log('newEndBin: ' + newEndBin)
      }

      //console.log(this.schematic.components.length)
      //console.log(this.props.store.getBeginBin + ' - ' + this.props.store.getEndBin)
      //console.log('index_to_component_to_visualize_dict: '  + Object.keys(index_to_component_to_visualize_dict))

      return newEndBin;
    }

    /** Compares bin2file @param indexContents with the beginBin and EndBin.
     * It finds the appropriate chunk URLS from the index and updates
     * switchChunkURLs which trigger json fetches for the new chunks. **/
    openRelevantChunksFromIndex() {
      console.log(
        "STEP #3: with new chunkIndex, this.openRelevantChunksFromIndex()"
      );

      if (
        this.props.store.chunkIndex === null ||
        !this.props.store.chunkIndex.zoom_levels.keys()
      ) {
        return; //before the class is fully initialized
      }
      const beginBin = this.props.store.getBeginBin;

      // With new chunkIndex, it sets the available zoom levels
      this.props.store.setAvailableZoomLevels(
        this.props.store.chunkIndex["zoom_levels"].keys()
      );

      const widthInColumns =
        window.innerWidth / this.props.store.pixelsPerColumn;

      const selZoomLev = this.props.store.getSelectedZoomLevel();
      let [fileArray, fileArrayFasta] = calculateEndBinFromScreen(
        beginBin,
        selZoomLev,
        this.props.store,
        widthInColumns
      );
      this.props.store.setLastBinPangenome(
        this.props.store.chunkIndex.zoom_levels.get(selZoomLev)["last_bin"]
      );

      const scaling_factor =
        this.props.store.getSelectedZoomLevel(true) /
        this.props.store.getSelectedZoomLevel();

      //console.log("scaling_factor: " + scaling_factor);

      if (scaling_factor !== 1) {
        if (scaling_factor < 1) {
          console.log(
            "[App.openRelevantChunksFromIndex] Zoom Highlight Boundaries set",
            Math.round(beginBin * scaling_factor),
            Math.round(this.props.store.getEndBin * scaling_factor)
          );
          this.props.store.setZoomHighlightBoundaries(
            Math.ceil(beginBin * scaling_factor),
            Math.ceil(this.props.store.getEndBin * scaling_factor)
          );
        }

        this.props.store.updateBeginEndBin(
          Math.round((beginBin - 1) * scaling_factor),
          Math.round((this.props.store.getEndBin - 1) * scaling_factor)
        );

        // The updating will re-trigger openRelevantChunksFromIndex
      } else {
        const newEndBin = this.prepareWhichComponentsToVisualize(
          widthInColumns
        );
        this.props.store.updateBeginEndBin(beginBin, newEndBin);

        //console.log([selZoomLev, endBin, fileArray, fileArrayFasta]);
        let URLprefix =
          process.env.PUBLIC_URL +
          "/test_data/" +
          this.props.store.jsonName +
          "/" +
          selZoomLev +
          "/";
        fileArray = fileArray.map((filename) => {
          return URLprefix + filename;
        });
        fileArrayFasta = fileArrayFasta.map((filename) => {
          return URLprefix + filename;
        });

        this.props.store.switchChunkFastaURLs(fileArrayFasta);

        // If there are no new chunck, it has only to recalculate the X layout
        if (!this.props.store.switchChunkURLs(fileArray)) {
          this.recalcXLayout();
        }
      }
    }

    fetchAllChunks() {
      /*Dispatches fetches for all chunk files
       * Read https://github.com/graph-genome/Schematize/issues/22 for details
       */
      console.log("STEP #5: once ChunkURLs are listed, go fetchAllChunks");
      //console.log("fetchAllChunks", this.props.store.chunkURLs);
      if (!this.props.store.chunkURLs.get(0)) {
        console.warn("No chunk URL defined.");
        return;
      }
      for (let chunkPath of this.props.store.chunkURLs) {
        //TODO: conditional on jsonCache not already having chunk
        //console.log("fetchAllChunks - START reading: " + chunkPath);
        this.schematic.jsonFetch(chunkPath).then((data) => {
          //console.log("fetchAllChunks - END reading: " + chunkPath);
          this.schematic.loadJsonCache(chunkPath, data);
        });
      }
    }

    updateSchematicMetadata() {
      if (
        arraysEqual(
          this.props.store.chunkURLs,
          this.props.store.chunksProcessed
        ) &&
        arraysEqual(
          this.props.store.chunkFastaURLs,
          this.props.store.chunksProcessedFasta
        )
      ) {
        console.log(
          "updateSchematicMetadata #components: " +
            this.schematic.components.length
        );
        console.log(
          "STEP #8: chunksProcessed finishing triggers updateSchematicMetadata with final rendering info for this loaded chunks"
        );

        const newEndBin = this.prepareWhichComponentsToVisualize(
          window.innerWidth / this.props.store.pixelsPerColumn
        );
        this.props.store.updateBeginEndBin(
          this.props.store.getBeginBin,
          newEndBin
        );

        // console.log(this.schematic.components);
        this.setState(
          {
            schematize: this.schematic.components,
            pathNames: this.schematic.pathNames,
          },
          () => {
            this.recalcXLayout();

            this.compressed_row_mapping = compress_visible_rows(
              this.schematic.components,
              this.schematic.pathNames,
              Array.from(this.props.store.metaData.keys())
            );
            this.maxNumRowsAcrossComponents = this.calcMaxNumRowsAcrossComponents(
              this.schematic.components
            ); // TODO add this to mobx-state-tree
            this.props.store.setLoading(false);
          }
        );
      }
    }

    recalcXLayout() {
      console.log("recalcXLayout");

      // In this way the updated relativePixelX information is available everywhere for the rendering
      for (const [
        i,
        schematizeComponent,
      ] of this.schematic.components.entries()) {
        schematizeComponent.relativePixelX = this.leftXStart(
          schematizeComponent,
          i,
          0,
          0
        );
      }
      // console.log("[App.recalcXLayout] Component List", this.schematic.components)
      let actualWidth = 0;
      if (Object.values(index_to_component_to_visualize_dict).length > 0) {
        // The actualWidth is calculated on the visualized components

        const first_visualized_component = Object.values(
          index_to_component_to_visualize_dict
        )[0];
        const last_visualized_component = Object.values(
          index_to_component_to_visualize_dict
        )[Object.values(index_to_component_to_visualize_dict).length - 1];

        const columnsInComponents =
          last_visualized_component.getColumnX(
            this.props.store.useWidthCompression
          ) -
          first_visualized_component.getColumnX(
            this.props.store.useWidthCompression
          ) +
          last_visualized_component.arrivals.length +
          last_visualized_component.departures.length +
          (this.props.store.useWidthCompression
            ? this.props.store.binScalingFactor
            : last_visualized_component.num_bin) -
          this._column_shift(first_visualized_component);

        actualWidth = columnsInComponents * this.props.store.pixelsPerColumn;
        //+ paddingBetweenComponents;
      }

      this.setState({
        actualWidth: actualWidth,
      });

      const [links, top] = calculateLinkCoordinates(
        this.props.store.components,
        this.props.store.pixelsPerColumn,
        this.props.store.topOffset,
        this.props.store.useWidthCompression,
        this.props.store.binScalingFactor,
        this.leftXStart.bind(this),
        index_to_component_to_visualize_dict
      );
      this.distanceSortedLinks = links;
      this.props.store.updateTopOffset(parseInt(top));
    }

    recalcY() {
      // forceUpdate() doesn't work with callback function
      this.setState({ highlightedLink: null }); // nothing code to force update.
    }

    calcMaxNumRowsAcrossComponents(components) {
      let lengths = components.map((x) => {
        return x.occupants.length;
      });
      return Math.max(...lengths); //this should likely be faster than doing a search for true values
    }

    // visibleHeightPixels() {
    //   if (index_to_component_to_visualize_dict === undefined) {
    //     return 0;
    //   }

    //   if (
    //     this.props.store.useVerticalCompression ||
    //     !this.compressed_row_mapping
    //   ) {
    //     // this.state.schematize.forEach(value => Math.max(value.occupants.filter(Boolean).length, maxNumberRowsInOneComponent));
    //     if (this.maxNumRowsAcrossComponents === undefined) {
    //       this.maxNumRowsAcrossComponents = this.calcMaxNumRowsAcrossComponents(
    //         Object.values(index_to_component_to_visualize_dict)
    //       );
    //       // TODO: This is part where the height of the component is defined. To make it equal for all views this needs to be modified
    //       // but also the top position of filled cell should also be modified.
    //     }
    //     /*console.log(
    //       "maxNumRowsAcrossComponents",
    //       this.maxNumRowsAcrossComponents
    //     );*/

    //     return (
    //       (this.maxNumRowsAcrossComponents + 1) * this.props.store.pixelsPerRow
    //     );
    //   } else {
    //     return (
    //       //TODO: NOTE that Object.keys is wrong if you change compressed_row_mapping to a mobx object
    //       (Object.keys(this.compressed_row_mapping).length + 0.25) *
    //       this.props.store.pixelsPerRow
    //     );
    //   }
    // }

    // Now it is wrapped in the updateHighlightedNode() function
    _updateHighlightedNode(linkRect) {
      this.setState({ highlightedLink: linkRect });
    }

    // Wrapper function to wrap the logic (no link selected and time delay)
    updateHighlightedNode = (linkRect) => {
      // The highlighting has to work only if there isn't any selected link
      if (!this.state.selectedLink) {
        if (linkRect != null) {
          // It comes from an handleMouseOver event

          clearTimeout(this.timerHighlightingLink);

          // To avoid unnecessary rendering when linkRect is still the this.state.highlightedLink link.
          if (this.state.highlightedLink !== linkRect) {
            // This ES6 syntaxt avoid to pass the result of the callback to setTimeoutwork.
            // It works because the ES6 arrow function does not change the context of this.
            this.timerHighlightingLink = setTimeout(
              () => {
                this._updateHighlightedNode(linkRect);
              },
              600 // TODO: value to tune. Create a config file where all these hard-coded settings will be
            );
          }
        } else {
          // It comes from an handleMouseOut event

          clearTimeout(this.timerHighlightingLink);

          // To avoid unnecessary rendering when linkRect == null and this.state.highlightedLink is already null for any reason.
          if (this.state.highlightedLink != null) {
            this.timerHighlightingLink = setTimeout(
              () => {
                this._updateHighlightedNode(linkRect);
              },
              600 // TODO: value to tune. Create a config file where all these hard-coded settings will be
            );
          }
        }
      }
    };

    updateSelectedLink = (linkRect) => {
      console.log("updateSelectedLink");

      let update_state = false;

      if (linkRect) {
        //TO_DO: lift down this logic when it will be visualized partial chunks (or
        // pass info about the visualized chunks to the LinkArrow tags)
        const [binLeft, binRight] = [
          linkRect.upstream,
          linkRect.downstream,
        ].sort(function (a, b) {
          return a - b;
        });

        /*console.log([linkRect.upstream, linkRect.downstream])
        console.log(binLeft, binRight)*/
        if (Object.values(index_to_component_to_visualize_dict).length === 0) {
          return; //bug: inconsistent state, just cancel the click event
        }
        const last_bin_last_visualized_component = Object.values(
          index_to_component_to_visualize_dict
        ).slice(-1)[0].lastBin;
        // if (linkRect !== this.state.selectedLink) //else it is a re-clik on the same link, so do nothing here

        const [beginBin, endBin] = this.props.store.beginEndBin;
        if (
          binLeft < beginBin ||
          binRight > last_bin_last_visualized_component
        ) {
          console.log("updateSelectedLink - NewBeginEndBin");

          const end_closer =
            Math.abs(beginBin - binLeft) > Math.abs(endBin - binRight);

          let [newBeginBin, newEndBin] = this.props.store.beginEndBin;
          let screenWidth = endBin - beginBin;
          let half = Math.floor(screenWidth / 2);
          if (end_closer) {
            [newBeginBin, newEndBin] = [binLeft - half, binLeft + half];
          } else {
            [newBeginBin, newEndBin] = [binRight - half, binRight + half];
          }

          this.props.store.updateBeginEndBin(newBeginBin, newEndBin);
          update_state = true;
        }
      }

      clearTimeout(this.timerHighlightingLink);

      // Update the rendering if it is selected a new arrow (or deselected the last one) or
      // if the range in changed (clicking on a new arrow or recliking on the same one)
      if (linkRect !== this.selectedLink || update_state) {
        console.log("updateSelectedLink - NewSelection");

        this.setState({
          highlightedLink: linkRect,
          selectedLink: linkRect,
        });
      }

      // Auto de-selection after a delay
      if (linkRect) {
        console.log("Timer deselection");

        // Eventually restart the timer if it was already ongoing
        clearTimeout(this.timerSelectionLink);

        this.timerSelectionLink = setTimeout(
          () => {
            this.updateSelectedLink(null);
          },
          5000 // TODO: to tune. Create a config file where all these hard-coded settings will be
        );
      }
    };

    // Specific utility function to calculate the visualization shift for the first partial visualized component
    _column_shift(first_visualized_component) {
      return !this.props.store.useWidthCompression
        ? first_visualized_component.firstBin === this.props.store.getBeginBin
          ? 0
          : first_visualized_component.arrivals.length +
            (this.props.store.getBeginBin - first_visualized_component.firstBin)
        : 0; // When only rearrangements are shown, the width does not correspond to the number of bin, so for now we avoid any shifting
    }

    leftXStart(schematizeComponent, i, firstDepartureColumn, j) {
      // Avoid calling the function too early or for not visualized components
      if (
        !(schematizeComponent.index in index_to_component_to_visualize_dict)
      ) {
        return -1;
      }

      //Return the x coordinate pixel that starts the LinkColumn at i, j

      const first_visualized_component = Object.values(
        index_to_component_to_visualize_dict
      )[0];

      /*
      - "schematizeComponent.getColumnX(...) - first_visualized_component.getColumnX(..)": offset of the current component respect to the first visualized one
      - "this._column_shift(first_visualized_component)"": to hide the arrow on the left
      - "(schematizeComponent.index - this.schematic.components[0].index": number of padding white columns
      */
      const previousColumns =
        schematizeComponent.getColumnX(this.props.store.useWidthCompression) -
        first_visualized_component.getColumnX(
          this.props.store.useWidthCompression
        ) -
        this._column_shift(first_visualized_component) -
        (schematizeComponent.index - this.schematic.components[0].index);

      const pixelsFromColumns =
        (previousColumns + firstDepartureColumn + j) *
        this.props.store.pixelsPerColumn;

      return pixelsFromColumns + i * this.props.store.pixelsPerColumn;
    }

    renderLinkColumn(schematizeComponent, firstColumn, linkColumn) {
      const name = firstColumn === 0 ? "arrival" : "departure";

      let offset = 0;
      // if (linkColumn.key[0]==="d" && linkColumn.downstream-linkColumn.upstream>0) {
      //   offset = 1;
      // }

      const xCoordArrival =
        schematizeComponent.relativePixelX +
        (firstColumn + linkColumn.order - offset) *
          this.props.store.pixelsPerColumn;
      // const [localColor, localOpacity, localStroke] = stringToColorAndOpacity(
      //   linkColumn,
      //   this.props.store.highlightedLink
      // );
      return (
        <LinkColumn
          store={this.props.store}
          key={name + schematizeComponent.index + linkColumn.order}
          item={linkColumn}
          parent={schematizeComponent}
          // pathNames={this.props.store.chunkIndex.pathNames}
          x={xCoordArrival}
          // pixelsPerRow={this.props.store.pixelsPerRow}
          // width={this.props.store.pixelsPerColumn}
          y={
            // this.props.store.topOffset +
            this.props.store.maxArrowHeight * this.props.store.pixelsPerColumn
          }
          // color={localColor}
          // opacity={localOpacity}
          // stroke={localStroke}
          // updateHighlightedNode={this.updateHighlightedNode}
          // compressed_row_mapping={this.compressed_row_mapping}
        />
      );
    }

    // renderLink(link) {
    //   const [localColor, localOpacity] = stringToColorAndOpacity(
    //     link.linkColumn,
    //     this.props.store.highlightedLink
    //   );

    //   return (
    //     <LinkArrow
    //       store={this.props.store}
    //       key={"arrow" + link.linkColumn.key}
    //       link={link}
    //       color={localColor}
    //       opacity={localOpacity}
    //       updateHighlightedNode={this.updateHighlightedNode}
    //       updateSelectedLink={this.updateSelectedLink}
    //     />
    //   );
    // }

    renderNucleotidesSchematic = () => {
      if (
        !this.props.store.loading &&
        // The conditions on binWidht and useWidthCompression are lifted here,
        // avoiding any computation if nucleotides have not to be visualized.
        this.props.store.getBinWidth === 1 &&
        !this.props.store.useWidthCompression &&
        this.props.store.pixelsPerColumn >= 10 &&
        this.props.store.nucleotides.length > 0
      ) {
        //console.log('renderNucleotidesSchematic - START')
        console.debug(
          "[App.renderNucleotidesSchematic] components",
          this.props.store.components
        );
        console.debug(
          "[App.renderNucleotidesSchematic] visualisedComponents",
          this.props.store.visualisedComponents
        );
        console.debug(
          "[App.renderNucleotidesSchematic] nucleotides " +
            this.props.store.nucleotides
        );
        return values(this.props.store.visualisedComponents).map(
          (component, i) => {
            // The dummy component (firstBin and lastBin equal to 0) is not loaded in this.schematic.components, but there is a nucleotide for it in the FASTA file.
            // If the first component has firstBin == 1, then in the FASTA there is a nucleotide not visualized, so the shift start from 0, and not 1
            // if (this.props.store.getBeginBin===42001) {
            //   debugger;
            // }
            let sortedArray = keys(this.props.store.components);
            sortedArray.sort((a, b) => Number(a) - Number(b));

            let nt_shift =
              this.props.store.components.get(sortedArray[0]).firstBin || 1;

            const nucleotides_slice = this.props.store.nucleotides.slice(
              component.firstBin - nt_shift, // firstBin is 1 indexed, but this is canceled by nt_shift
              component.lastBin - nt_shift + 1 // inclusive end
            );

            console.debug(
              "[App.renderNucleotidesSchematic] nt_shift",
              nt_shift
            );
            console.debug(
              "[App.renderNucleotidesSchematic] nucleotides_slice: " +
                nucleotides_slice
            );

            return (
              <React.Fragment key={"nt" + i}>
                <ComponentNucleotides
                  store={this.props.store}
                  item={component}
                  key={i}
                  y={
                    this.props.store.topOffset +
                    (this.props.store.maxArrowHeight + 1) *
                      this.props.store.pixelsPerColumn
                  }
                  // They are passed only the nucleotides associated to the current component
                  nucleotides={nucleotides_slice}
                />
              </React.Fragment>
            );
          }
        );
      }
    };

    renderComponent(schematizeComponent, i) {
      // console.log("[App.renderComponent] rendering component",schematizeComponent)
      let width;
      let leftCut = false;
      let rightCut = false;
      if (this.props.store.getBeginBin > schematizeComponent.firstBin) {
        width =
          schematizeComponent.lastBin -
          this.props.store.getBeginBin +
          1 +
          schematizeComponent.departures.size -
          1;
        leftCut = true;
      } else {
        width =
          schematizeComponent.arrivals.size +
          schematizeComponent.numBins +
          schematizeComponent.departures.size -
          1;
      }

      if (this.props.store.getEndBin < schematizeComponent.lastBin) {
        width -= schematizeComponent.lastBin - this.props.store.getEndBin;
        rightCut = true;
      } else if (
        this.props.store.getEndBin === schematizeComponent.lastBin &&
        !schematizeComponent.departureVisible
      ) {
        rightCut = true;
      }

      return (
        <>
          <ComponentRect
            store={this.props.store}
            item={schematizeComponent}
            key={"r" + Math.random()}
            y={
              // this.props.store.topOffset +
              this.props.store.maxArrowHeight * this.props.store.pixelsPerColumn
            }
            height={
              this.props.store.chunkIndex.pathNames.length *
              this.props.store.pixelsPerRow
            }
            widthInColumns={width}
          />
          {!leftCut
            ? values(schematizeComponent.arrivals).map((linkColumn) => {
                return this.renderLinkColumn(
                  schematizeComponent,
                  0,
                  linkColumn
                );
              })
            : null}
          {!rightCut
            ? values(schematizeComponent.departures).map((linkColumn, j) => {
                if (linkColumn.upstream + 1 == linkColumn.downstream) {
                  return null;
                }
                let leftPad;

                if (leftCut) {
                  leftPad =
                    schematizeComponent.lastBin -
                    this.props.store.getBeginBin +
                    1;
                } else {
                  leftPad =
                    schematizeComponent.arrivals.size +
                    (this.props.store.useWidthCompression
                      ? this.props.store.binScalingFactor
                      : schematizeComponent.numBins);
                }
                return this.renderLinkColumn(
                  schematizeComponent,
                  leftPad,
                  linkColumn
                );
              })
            : null}
        </>
      );
    }

    renderSchematic() {
      // console.debug("[App.renderSchematic]");

      if (this.props.store.loading) {
        return null;
      }
      // console.log("[App.renderSchematic] component list", this.schematic.components)
      // console.log("[App.renderSchematic] index_to_component_to_visualize_dict", index_to_component_to_visualize_dict)
      console.debug(
        "[App.renderSchematic] visualisedComponents",
        this.props.store.visualisedComponents
      );
      return this.props.store.sortedVisualComponentsKeys.map((index, i) => {
        let schematizeComponent = this.props.store.visualisedComponents.get(
          index
        );
        return (
          <React.Fragment key={"f" + i}>
            {this.renderComponent(schematizeComponent, i)}
          </React.Fragment>
        );
      });
    }

    renderSortedLinks() {
      if (this.props.store.loading) {
        return;
      }

      return this.distanceSortedLinks.map((record, i) => {
        return this.renderLink(record);
      });
    }

    loadingMessage() {
      if (this.props.store.loading) {
        return (
          <Text
            key="loading"
            y={100}
            fontSize={60}
            width={300}
            align="center"
            text="Loading index... "
          />
        );
      }
    }

    handleClick = (event) => {
      this.props.store.updateBeginEndBin(
        Math.max(
          Math.floor(
            (this.props.store.last_bin_pangenome * event.evt.offsetX) /
              (event.currentTarget.attrs.width +
                event.currentTarget.attrs.strokeWidth)
          ),
          1
        )
      );
    };
    handleMouseMove = (event) => {
      this.props.store.updateCellTooltipContent(
        "Go to bin: " +
          Math.max(
            Math.floor(
              (this.props.store.last_bin_pangenome * event.evt.offsetX) /
                (event.currentTarget.attrs.width +
                  event.currentTarget.attrs.strokeWidth)
            ),
            1
          )
      );
    };
    handleMouseOut = () => {
      this.props.store.updateCellTooltipContent("");
    };

    render() {
      // if (this.props.store.loading) {
      //   return this.loadingMessage();
      // }

      // console.debug("[App.render] loading index status", this.props.store.loading)
      console.log("Start render");

      //this.state.actualWidth - 2
      // const navigation_bar_width = window.innerWidth - 2;

      // let x_navigation =
      //   this.props.store.getBeginBin === 1
      //     ? 0
      //     : Math.ceil(
      //         (this.props.store.getBeginBin /
      //           this.props.store.last_bin_pangenome) *
      //           navigation_bar_width
      //       );

      // let width_navigation = Math.ceil(
      //   ((this.props.store.getEndBin - this.props.store.getBeginBin + 1) /
      //     this.props.store.last_bin_pangenome) *
      //     navigation_bar_width
      // );

      // if (x_navigation + width_navigation > navigation_bar_width) {
      //   width_navigation = navigation_bar_width - x_navigation;
      // }

      /*console.log("navigation_bar_width " + navigation_bar_width);
      console.log("x_navigation " + x_navigation);
      console.log("width_navigation " + width_navigation);*/
      console.debug("[App.render] store.topOffset", this.props.store.topOffset);
      console.debug(
        "[App.render] store.maxArrowHeight",
        this.props.store.maxArrowHeight
      );

      return (
        <>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: "2",
              background: "white",

              // To keep the matrix under the container with the vertical scrolling
              // when the matrix is larger than the page
              width: this.props.store.actualWidth,

              // To avoid width too low with large bin_width
              minWidth: "100%",
            }}
          >
            <ControlHeader store={this.props.store} />
            {this.props.store.navigation_bar_width > 0 ? (
              <Stage
                x={this.props.store.leftOffset}
                y={0}
                style={{ cursor: "pointer" }}
                width={this.props.store.navigation_bar_width + 2}
                height={this.props.store.heightNavigationBar + 4}
              >
                <Layer ref={this.layerNavigationBar}>
                  <Rect
                    y={2}
                    width={this.props.store.navigation_bar_width}
                    height={this.props.store.heightNavigationBar}
                    fill={"lightblue"}
                    stroke={"gray"}
                    strokeWidth={2}
                    onMouseMove={this.handleMouseMove}
                    onMouseOut={this.handleMouseOut}
                    onClick={this.handleClick}
                  />
                  <Rect
                    x={this.props.store.x_navigation}
                    y={2}
                    width={this.props.store.width_navigation}
                    height={this.props.store.heightNavigationBar}
                    fill={"orange"}
                    stroke={"brown"}
                    strokeWidth={2}
                    opacity={0.7}
                  />
                </Layer>
              </Stage>
            ) : null}
          </div>

          {this.props.store.loading &&
          this.props.store.visualisedComponents.size === 0 ? null : (
            <Stage
              x={this.props.store.leftOffset} // removed leftOffset to simplify code. Relative coordinates are always better.
              y={2 * this.props.store.pixelsPerColumn * 2} // For some reason, I have to put this, but I'd like to put 0
              width={this.props.store.actualWidth}
              height={
                this.props.store.chunkIndex.pathNames.length *
                  this.props.store.pixelsPerRow +
                (this.props.store.maxArrowHeight + 5) *
                  this.props.store.pixelsPerColumn
              }
            >
              <Layer ref={this.layerRef}>
                {this.renderNucleotidesSchematic()}
                {this.renderSchematic()}
              </Layer>
            </Stage>
          )}
          <NucleotideTooltip store={this.props.store} />
          <Legend store={this.props.store} />
        </>
      );
    }
  }
);
// render(<App />, document.getElementById('root'));

export default App;
