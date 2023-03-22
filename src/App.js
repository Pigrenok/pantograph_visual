import { Layer, Stage, Text, Rect, Line, Arrow } from "react-konva";
import React, { Component } from "react";

import "./App.css";
import ComponentRect from "./ComponentRect";
import ConnectorRect from "./ComponentConnectorRect";
import ComponentNucleotides from "./ComponentNucleotides";
import LinkColumn from "./LinkColumn";
import NucleotideTooltip from "./NucleotideTooltip";
import ControlHeader from "./ControlHeader";
import { values } from "mobx";
import { observer } from "mobx-react";

function Legend(props) {
  return (
    <Stage
      width={120}
      height={45 + 15 * props.store.copyNumberColorArray.length}
    >
      <Layer>
        <Text x={10} y={0} fontSize={10} text={"Copy Number Legend"} />
        <Text x={20} y={15} fontSize={10} text={"Normal"} />
        <Text x={60} y={15} fontSize={10} text={"Inverted"} />

        {/*Copy 0*/}
        <Text x={20} y={30} fontSize={10} text={"0"} />
        <Rect
          x={35}
          y={30}
          width={10}
          height={10}
          stroke="gray"
          fill={"white"}
        />

        <Text x={63} y={30} fontSize={10} text={"0"} />
        <Rect
          x={78}
          y={30}
          width={10}
          height={10}
          stroke="gray"
          fill={"white"}
        />

        {props.store.copyNumberColorArray.map((colour, i) => (
          <>
            <Text
              x={i === 9 ? 15 : 20}
              y={45 + i * 15}
              fontSize={10}
              text={(i === 9 ? "≥" : "") + (i + 1).toString()}
            />
            <Rect x={35} y={45 + i * 15} width={10} height={10} fill={colour} />
          </>
        ))}

        {props.store.invertedColorArray.map((colour, i) => (
          <>
            <Text
              x={i === 9 ? 58 : 63}
              y={45 + i * 15}
              fontSize={10}
              text={(i === 9 ? "≥" : "") + (i + 1).toString()}
            />
            <Rect x={78} y={45 + i * 15} width={10} height={10} fill={colour} />
          </>
        ))}
      </Layer>
    </Stage>
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
      super(props);

      // When App is just created, data index together with case index for each available project should be loaded.
      // After that specific project and case should be selected to render initially.
      // All this is taken care by `loadProjects` and related functions.

      let selectedProject = null;
      if (this.props.selectedProject !== undefined) {
        selectedProject = this.props.selectedProject;
      }

      let selectedCase = null;
      if (this.props.selectedProjectCase !== undefined) {
        selectedCase = this.props.selectedProjectCase;
      }

      this.props.store.loadProjects(selectedProject, selectedCase).then(() => {
        this.props.store.setLoading(false);
        this.props.store.updateWindow(window.innerWidth);
        window.addEventListener("resize", () =>
          this.props.store.updateWindow(window.innerWidth)
        );
      });
    }

    renderLinkColumn(schematizeComponent, firstColumn, linkColumn, side) {
      // Component can have multiple link columns and this functions renders individual column
      // This function is used by `renderComponentLinks`.
      let name = side + "_";

      name += linkColumn.key[0];

      let offset = 0;

      const xCoordArrival =
        schematizeComponent.relativePixelX +
        (firstColumn + linkColumn.order - offset) *
          this.props.store.pixelsPerColumn;
      return (
        <LinkColumn
          store={this.props.store}
          key={name + schematizeComponent.index + linkColumn.order}
          item={linkColumn}
          side={side}
          parent={schematizeComponent}
          x={xCoordArrival}
          y={this.props.store.maxArrowHeight * this.props.store.pixelsPerColumn}
        />
      );
    }

    renderNucleotidesSchematic = () => {
      // At the lowest level zoom (nucleotide resolution) nucleotide sequence (if provided) will be shown.
      // This function is doing exactly this.

      if (
        !this.props.store.chunkLoading &&
        // The conditions on binWidht and useWidthCompression are lifted here,
        // avoiding any computation if nucleotides have not to be visualized.
        this.props.store.getBinWidth === 1 &&
        this.props.store.pixelsPerColumn >= 10
      ) {
        return values(this.props.store.visualisedComponents).map(
          (component, i) => {
            if (component.sequence.length == component.numBins) {
              return (
                <React.Fragment key={"nt" + i}>
                  <ComponentNucleotides
                    store={this.props.store}
                    item={component}
                    key={i}
                    y={
                      this.props.store.maxArrowHeight *
                      this.props.store.pixelsPerColumn
                    }
                    // They are passed only the nucleotides associated to the current component
                    nucleotides={component.sequence}
                  />
                </React.Fragment>
              );
            }
          }
        );
      }
    };

    renderComponentLinks(schematizeComponent, compInd, leftCut, rightCut) {
      // Rendering all links (including continuity links) for specific component.

      let resArray = [];

      if (!leftCut) {
        resArray = resArray.concat(
          values(schematizeComponent.larrivals).map((linkColumn) => {
            return this.renderLinkColumn(
              schematizeComponent,
              0,
              linkColumn,
              "left"
            );
          })
        );

        resArray = resArray.concat(
          values(schematizeComponent.ldepartures).map((linkColumn) => {
            return this.renderLinkColumn(
              schematizeComponent,
              0,
              linkColumn,
              "left"
            );
          })
        );
      }

      if (!rightCut) {
        resArray = resArray.concat(
          values(schematizeComponent.rdepartures).map((linkColumn, j) => {
            // Check each pathID if the other side is right arrival.
            // If any exist, list paths with that true and pass it to this.renderLinkColumn
            if (
              linkColumn.upstream + 1 == linkColumn.downstream &&
              !linkColumn.otherSideRight
            ) {
              //Check that the created list of pathIDs is empty.
              return null;
            }
            let leftPad;

            if (leftCut) {
              leftPad =
                schematizeComponent.lastBin - this.props.store.getBeginBin + 1;
            } else {
              leftPad =
                schematizeComponent.leftLinkSize + schematizeComponent.numBins;
            }

            return this.renderLinkColumn(
              schematizeComponent,
              leftPad,
              linkColumn,
              "right"
            );
          })
        );

        resArray = resArray.concat(
          values(schematizeComponent.rarrivals).map((linkColumn, j) => {
            // Check each pathID if the other side is right departure.
            // If any exist, list paths with that true and pass it to this.renderLinkColumn
            if (
              linkColumn.downstream + 1 == linkColumn.upstream &&
              !linkColumn.otherSideRight
            ) {
              //Check that the created list of pathIDs is empty.
              return null;
            }
            let leftPad;

            if (leftCut) {
              leftPad =
                schematizeComponent.lastBin - this.props.store.getBeginBin + 1;
            } else {
              leftPad =
                schematizeComponent.leftLinkSize + schematizeComponent.numBins;
            }

            return this.renderLinkColumn(
              schematizeComponent,
              leftPad,
              linkColumn,
              "right"
            );
          })
        );
      }
      // next component this.props.store.visualisedComponents[i+1]

      if (!leftCut) {
        let prevComp;

        if (compInd > 0) {
          let prevCompID =
            this.props.store.sortedVisualComponentsKeys[compInd - 1];
          prevComp = this.props.store.visualisedComponents.get(prevCompID);
        } else if (schematizeComponent.firstBin > 1) {
          prevComp = this.props.store.leftCompInvisible;
        }
        if (prevComp !== undefined) {
          let prevConnectorD = prevComp.connectorDepartures;
          if (prevConnectorD !== null) {
            resArray = resArray.concat(
              prevConnectorD.participants.map((participant, i) => {
                return (
                  <ConnectorRect
                    participant={participant}
                    item={schematizeComponent}
                    itemIndex={schematizeComponent.index}
                    store={this.props.store}
                    isRight={false}
                    isInverse={false}
                  />
                );
              })
            );
          }

          let prevConnectorA = prevComp.connectorArrivals;
          if (prevConnectorA !== null) {
            resArray = resArray.concat(
              prevConnectorA.participants.map((participant, i) => {
                return (
                  <ConnectorRect
                    participant={participant}
                    item={schematizeComponent}
                    itemIndex={schematizeComponent.index}
                    store={this.props.store}
                    isRight={false}
                    isInverse={true}
                  />
                );
              })
            );
          }
        }
      }

      if (!rightCut) {
        let connectorDR = schematizeComponent.connectorDepartures;
        if (connectorDR !== null) {
          resArray = resArray.concat(
            connectorDR.participants.map((participant, i) => {
              return (
                <ConnectorRect
                  participant={participant}
                  item={schematizeComponent}
                  itemIndex={schematizeComponent.index}
                  store={this.props.store}
                  isRight={true}
                  isInverse={false}
                />
              );
            })
          );
        }

        let connectorA = schematizeComponent.connectorArrivals;
        if (connectorA !== null) {
          resArray = resArray.concat(
            connectorA.participants.map((participant, i) => {
              return (
                <ConnectorRect
                  participant={participant}
                  item={schematizeComponent}
                  itemIndex={schematizeComponent.index}
                  store={this.props.store}
                  isRight={true}
                  isInverse={true}
                />
              );
            })
          );
        }
      }

      return resArray;
    }

    renderComponent(schematizeComponent, i) {
      // Rendering individual component. Used by `renderSchematic` function.

      let width;
      let leftCut = false;
      let rightCut = false;
      if (
        this.props.store.getBeginBin > schematizeComponent.firstBin ||
        !schematizeComponent.arrivalVisible
      ) {
        width =
          schematizeComponent.lastBin -
          this.props.store.getBeginBin +
          1 +
          schematizeComponent.rightLinkSize;
        leftCut = true;
      } else {
        width =
          schematizeComponent.leftLinkSize +
          schematizeComponent.numBins +
          schematizeComponent.rightLinkSize;
      }

      if (this.props.store.getEndBin < schematizeComponent.lastBin) {
        width -=
          schematizeComponent.lastBin -
          this.props.store.getEndBin +
          schematizeComponent.rightLinkSize;
        rightCut = true;
      } else if (
        this.props.store.getEndBin === schematizeComponent.lastBin &&
        !schematizeComponent.departureVisible
      ) {
        width -= schematizeComponent.rightLinkSize;
        rightCut = true;
      }

      return (
        <>
          <ComponentRect
            store={this.props.store}
            item={schematizeComponent}
            key={"r" + schematizeComponent.index}
            y={
              this.props.store.maxArrowHeight * this.props.store.pixelsPerColumn
            }
            height={
              this.props.store.chunkIndex.pathNames.length *
              this.props.store.pixelsPerRow
            }
            widthInColumns={width}
          />
          {this.renderComponentLinks(schematizeComponent, i, leftCut, rightCut)}
        </>
      );
    }

    renderCentreLine() {
      // Showing the centreline where the current position is set to.
      let x =
        this.props.store.centreBinEndPos -
        Math.round(this.props.store.pixelsPerColumn * 0.5);

      let y =
        this.props.store.maxArrowHeight * this.props.store.pixelsPerColumn;

      let height =
        (this.props.store.chunkIndex.pathNames.length + 1) *
        this.props.store.pixelsPerRow;

      return (
        <Line points={[x, y, x, y + height]} stroke={"red"} strokeWidth={1} />
      );
    }

    renderZoomRect() {
      // When the user moves to higher level zoom, a rectangle is drawn to highlight the part of matrix that was
      // visible on previous zoom level. It disappear on its own.
      if (this.props.store.zoomHighlightBoundariesCoord.length == 2) {
        let leftCoord = Math.min(
          ...this.props.store.zoomHighlightBoundariesCoord
        );
        let rightCoord = Math.max(
          ...this.props.store.zoomHighlightBoundariesCoord
        );
        let x = leftCoord;
        let y =
          this.props.store.maxArrowHeight * this.props.store.pixelsPerColumn;

        let width = rightCoord - leftCoord;
        let height =
          this.props.store.chunkIndex.pathNames.length *
            this.props.store.pixelsPerRow -
          1;
        return (
          <>
            <Line
              points={[x, y, x, y + height]}
              stroke={"red"}
              strokeWidth={4}
              key={"ZoomMarker1"}
            />
            <Line
              points={[x + width, y, x + width, y + height]}
              stroke={"red"}
              strokeWidth={4}
              key={"ZoomMarker2"}
            />
            <Line
              points={[x, y, x + width, y]}
              stroke={"red"}
              strokeWidth={4}
              key={"ZoomMarker3"}
            />
            <Line
              points={[x, y + height, x + width, y + height]}
              stroke={"red"}
              strokeWidth={4}
              key={"ZoomMarker4"}
            />
          </>
        );
      } else if (this.props.store.zoomHighlightBoundariesCoord.length == 1) {
        let xPos = this.props.store.zoomHighlightBoundariesCoord[0];
        let y =
          this.props.store.maxArrowHeight * this.props.store.pixelsPerColumn;
        let height =
          this.props.store.chunkIndex.pathNames.length *
            this.props.store.pixelsPerRow -
          1;
        return (
          <Line
            points={[xPos, y, xPos, y + height]}
            stroke={"red"}
            strokeWidth={4}
            key={"ZoomMarker"}
          />
        );
      } else {
        return null;
      }
    }

    renderSchematic() {
      // Rendering main graph matrix
      if (this.props.store.chunkLoading) {
        return null;
      }

      return this.props.store.sortedVisualComponentsKeys.map((index, i) => {
        let schematizeComponent =
          this.props.store.visualisedComponents.get(index);
        return (
          <React.Fragment key={"f" + i}>
            {this.renderComponent(schematizeComponent, i)}
          </React.Fragment>
        );
      });
    }

    loadingMessage() {
      if (this.props.store.chunkLoading) {
        return (
          <Text
            key={"loading"}
            x={10}
            y={100}
            fontSize={60}
            width={300}
            height={100}
            align={"center"}
            text={"Loading index... "}
          />
        );
      }
    }

    handleClick = (event) => {
      // Jump by navigation bar
      this.props.store.updatePosition(
        Math.max(
          Math.floor(
            ((this.props.store.last_bin_pangenome + 1) * event.evt.clientX) /
              this.props.store.windowWidth
          ),
          1
        )
      );
    };
    handleMouseMove = (event) => {
      // Tooltip for navigation bar
      this.props.store.updateCellTooltipContent(
        "Go to bin: " +
          Math.max(
            Math.floor(
              ((this.props.store.last_bin_pangenome + 1) * event.evt.clientX) /
                this.props.store.windowWidth
            ),
            1
          )
      );
      this.props.store.updateMouse(event.evt.clientX, event.evt.clientY);
    };
    handleMouseOut = () => {
      // Hide navigation bar tool tip if left
      this.props.store.updateCellTooltipContent("");
    };

    render() {
      if (this.props.store.chunkLoading) {
        return this.loadingMessage();
      }

      console.log("Start render");

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
                    onMouseMove={this.handleMouseMove}
                    onMouseOut={this.handleMouseOut}
                    onClick={this.handleClick}
                    opacity={0.7}
                  />
                </Layer>
              </Stage>
            ) : null}
          </div>

          <div id="mainDiv">
            {this.props.store.chunkLoading ? null : (
              <Stage
                x={this.props.store.leftOffset}
                y={2 * this.props.store.pixelsPerColumn * 2}
                width={this.props.store.windowWidth}
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
                  {this.renderZoomRect()}
                  {this.renderCentreLine()}
                </Layer>
              </Stage>
            )}

            <div
              id="Legend"
              style={{
                display: "block",
                position: "absolute",
                bottom: 0,
              }}
            >
              <Legend store={this.props.store} />
            </div>
            <NucleotideTooltip store={this.props.store} />
            <div id="floating" style={{ display: "none" }}></div>
          </div>
        </>
      );
    }
  }
);

export default App;
