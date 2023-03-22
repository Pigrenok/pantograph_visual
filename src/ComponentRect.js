import React from "react";
import { Rect, Line } from "react-konva";
import { observer } from "mobx-react";
import { values } from "mobx";
import { SpanCell } from "./SpanCell";
import { binFromCol } from "./utilities";

const ComponentRect = observer(
  class extends React.Component {
    constructor(props) {
      super(props);
    }

    handleClick = () => {
      // Select component on click
      if (this.isSelected) {
        this.props.store.delFromSelection(
          this.props.item.firstCol,
          this.props.item.lastCol
        );
      } else {
        this.props.store.addToSelection(
          this.props.item.firstCol,
          this.props.item.lastCol
        );
      }
    };

    get isSelected() {
      // Getter to check whether this component is selected.
      // If it is, it is drawn differently.
      return (
        this.props.store.selectedComponents.filter((val) => {
          return (
            (this.props.item.lastCol - val[0]) *
              (val[1] - this.props.item.firstCol) >=
            0
          );
        }).length > 0
      );
    }

    renderMatrix() {
      // This rendering matrix row for each accession.
      let parts = values(this.props.item.matrix).map((entry) => {
        return this.renderMatrixRow(entry);
      });
      return <>{parts}</>;
    }

    calcStartOfCols() {
      // Calculate where to start drawing given component's main matrix (not link columns)
      let this_x;
      if (
        this.props.store.getBeginBin > this.props.item.firstBin ||
        !this.props.item.arrivalVisible
      ) {
        this_x = this.props.item.relativePixelX;
      } else {
        this_x =
          this.props.item.relativePixelX +
          this.props.item.leftLinkSize * this.props.store.pixelsPerColumn;
      }

      return this_x;
    }

    renderMatrixRow(entry) {
      // Rendering individual matrix row for an accession/path.
      let this_y = entry.pathID;

      let this_x = this.calcStartOfCols();

      let pathName = this.props.store.chunkIndex.pathNames[entry.pathID];

      return (
        <SpanCell
          key={"occupant" + this_y}
          entry={entry}
          parent={this.props.item}
          store={this.props.store}
          pathName={pathName}
          //color={rowColor}
          x={this_x}
          y={this_y * this.props.store.pixelsPerRow + this.props.y}
          rowNumber={this_y}
          handleClickMethod={this.handleClick}
        />
      );
    }

    renderSeparators() {
      // Draws horizontal lines separating individual accession rows.
      const lines = [];

      for (let h = 0; h <= this.props.store.chunkIndex.pathNames.length; h++) {
        let colour = "black";
        if (
          h === this.props.store.filterMainAccession ||
          h - 1 === this.props.store.filterMainAccession
        ) {
          colour = "blue";
        }
        lines.push(
          <Line
            points={[
              this.props.item.relativePixelX,
              this.props.y + h * this.props.store.pixelsPerRow,
              this.props.item.relativePixelX +
                this.props.widthInColumns * this.props.store.pixelsPerColumn,
              this.props.y + h * this.props.store.pixelsPerRow,
            ]}
            stroke={colour}
            strokeWidth={1}
            key={"LineHeight" + h}
          />
        );
      }
      return <>{lines}</>;
    }

    renderBlockMarker() {
      // Render vertical lines bounding each component main matrix and link columns.
      let colour = this.isSelected ? "red" : "blue";

      return (
        <>
          {this.props.item.arrivalVisible ? (
            <Line
              points={[
                this.props.item.relativePixelX,
                this.props.y,
                this.props.item.relativePixelX,
                this.props.y + this.props.height - 1,
              ]}
              stroke={colour}
              strokeWidth={2}
              key={"LeftSelectionMarker"}
            />
          ) : null}
          {this.props.item.departureVisible ? (
            <Line
              points={[
                this.props.item.relativePixelX +
                  this.props.widthInColumns * this.props.store.pixelsPerColumn,
                this.props.y,
                this.props.item.relativePixelX +
                  this.props.widthInColumns * this.props.store.pixelsPerColumn,
                this.props.y + this.props.height - 1,
              ]}
              stroke={colour}
              strokeWidth={2}
              key={"RightSelectionMarker"}
            />
          ) : null}
        </>
      );
    }

    renderLinkBoundary() {
      // It draws rectangles bounding link columns (both left and right) for the component
      // At the moment it is not used, and I guess, it was introduced for specific reason,
      // which possibly already gone.
      // I left it here (and places where they were called) just in case this will be needed.
      let colour = "white";
      let lineWidth = 0;
      let opacity = 0.1;

      let lines = [];

      if (
        this.props.item.firstBin >= this.props.store.getBeginBin &&
        this.props.item.leftLinkSize > 0 &&
        this.props.item.arrivalVisible
      ) {
        lines.push(
          <Rect
            key={"a" + this.props.item.index}
            x={this.props.item.relativePixelX}
            y={this.props.y}
            width={
              this.props.item.leftLinkSize * this.props.store.pixelsPerColumn
            }
            height={this.props.height - 1}
            fill={colour}
            opacity={opacity}
            stroke={colour}
            strokeWidth={lineWidth}
            onClick={this.handleClick}
            onMouseOver={this.onHover.bind(this)}
            onMouseLeave={this.onLeave.bind(this)}
          />
        );
      }

      if (
        this.props.item.departureVisible &&
        this.props.item.rightLinkSize > 0
      ) {
        lines.push(
          <Rect
            key={"d" + this.props.item.index}
            x={
              this.props.item.relativePixelX +
              ((this.props.item.arrivalVisible
                ? this.props.item.leftLinkSize
                : 0) +
                this.props.item.numBins) *
                this.props.store.pixelsPerColumn
            }
            y={this.props.y}
            width={
              this.props.item.rightLinkSize * this.props.store.pixelsPerColumn
            }
            height={this.props.height - 1}
            fill={colour}
            opacity={opacity}
            stroke={colour}
            strokeWidth={lineWidth}
            onClick={this.handleClick}
            onMouseOver={this.onHover.bind(this)}
            onMouseLeave={this.onLeave.bind(this)}
          />
        );
      }

      return <>{lines}</>;
    }

    renderZoomBoundary() {
      // This function checks if the zoom boundary lies within this component.
      // If yes, it calculates specific coordinates and push to the store.
      // App function `renderZoomRect` will pull them and draw actual rectangle.

      if (
        this.props.item.firstCol <=
          this.props.store.zoomHighlightBoundaries[0] &&
        this.props.item.lastCol >=
          this.props.store.zoomHighlightBoundaries[0] &&
        this.props.store.zoomHighlightBoundariesCoord.length === 0
      ) {
        let xPosLeft =
          this.props.item.relativePixelX +
          (this.props.item.leftLinkSize +
            (binFromCol(
              this.props.item,
              this.props.store.zoomHighlightBoundaries[0]
            ) -
              this.props.item.firstBin)) *
            this.props.store.pixelsPerColumn;
        this.props.store.addZoomHighlightBoundCoord(xPosLeft);
      }

      if (
        this.props.item.firstCol <=
          this.props.store.zoomHighlightBoundaries[1] &&
        this.props.item.lastCol >=
          this.props.store.zoomHighlightBoundaries[1] &&
        this.props.store.zoomHighlightBoundariesCoord.length === 1
      ) {
        let xPosRight =
          this.props.item.relativePixelX +
          (this.props.item.leftLinkSize +
            (binFromCol(
              this.props.item,
              this.props.store.zoomHighlightBoundaries[1]
            ) -
              this.props.item.firstBin +
              1)) *
            this.props.store.pixelsPerColumn;
        this.props.store.addZoomHighlightBoundCoord(xPosRight);
      }

      window.setTimeout(() => {
        this.props.store.clearZoomHighlightBoundaries();
      }, 10000);
    }

    renderHighlightCell() {
      // When floating window with metadata is openned, this function highlight the cell
      // for which details are shown.
      return (
        <Rect
          x={
            this.calcStartOfCols() +
            (this.props.store.highlightedCell.bin - this.props.item.firstBin) *
              this.props.store.pixelsPerColumn
          }
          y={
            this.props.y +
            this.props.store.highlightedCell.accession *
              this.props.store.pixelsPerRow
          }
          key={this.props.item.index + "highlight"}
          width={this.props.store.pixelsPerColumn}
          height={this.props.store.pixelsPerRow}
          fill={"lawngreen"}
        />
      );
    }

    render() {
      if (this.props.store.chunkLoading) {
        return null;
      }

      let highlight = false;
      if (this.props.store.highlightedCell !== null) {
        if (
          this.props.store.highlightedCell.bin >= this.props.item.firstBin &&
          this.props.store.highlightedCell.bin <= this.props.item.lastBin
        ) {
          highlight = true;
        }
      }
      if (this.props.store.zoomHighlightBoundaries.length === 2) {
        this.renderZoomBoundary();
      }

      return (
        <>
          <Rect
            x={this.props.item.relativePixelX}
            y={this.props.y}
            key={this.props.item.index + "R"}
            width={this.props.widthInColumns * this.props.store.pixelsPerColumn}
            height={this.props.height - 2} //TODO: change to compressed height
            fill={this.isSelected ? "lightblue" : "white"}
            onClick={this.handleClick}
            onMouseOver={this.onHover.bind(this)}
            onMouseLeave={this.onLeave.bind(this)}
          />
          {/*{this.renderLinkBoundary()}*/}
          {!this.props.store.useWidthCompression ? this.renderMatrix() : null}
          {/*{this.props.store.useConnector ? this.renderAllConnectors() : null}*/}
          {this.renderSeparators()}
          {this.renderBlockMarker()}
          {/*{this.renderLinkBoundary()}*/}
          {highlight ? this.renderHighlightCell() : null}
        </>
      );
    }

    onHover(event) {
      // Showing tool tip for empty cells in both main matrix and link columns.
      this.props.store.updateCellTooltipContent(
        "Bin range: " +
          this.props.item.firstBin +
          " - " +
          this.props.item.lastBin
      );
      this.props.store.updateMouse(event.evt.clientX, event.evt.clientY);
    }

    onLeave(event) {
      this.props.store.updateCellTooltipContent("");
    }
  }
);

export default ComponentRect;
