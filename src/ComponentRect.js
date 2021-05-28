/* eslint-disable require-jsdoc */
import React from "react";
import { Rect, Line } from "react-konva";
import { observer } from "mobx-react";
import { values } from "mobx";
import { ConnectorRect } from "./ComponentConnectorRect";
import { SpanCell } from "./SpanCell";
import PropTypes from "prop-types";
import { sum } from "./utilities";

function colorFromStr(colorKey) {
  colorKey = colorKey.toString();
  let hash = 0;
  for (let i = 0; i < colorKey.length; i++) {
    hash = colorKey.charCodeAt(i) + ((hash << 5) - hash);
  }
  let colour = "#";
  for (let j = 0; j < 3; j++) {
    let value = (hash >> (j * 8)) & 0xff;
    colour += ("00" + value.toString(16)).substr(-2);
  }
  return colour;
}

export function compress_visible_rows(components, pathNames, annotationNames) {
  /*Returns a Map with key of the original row number and value of the new, compressed row number.
   * Use this for y values of occupancy and LinkColumn cells.  */
  let all_visible = new Set();
  for (let c of components) {
    for (let row of c.occupants) {
      all_visible.add(row);
    }
  }

  let row_mapping = {};
  let ordered_num_rows = {};
  if (annotationNames.length > 0) {
    let all_annotation_num_rows = new Set();
    for (let annotationName of annotationNames) {
      all_annotation_num_rows.add(pathNames.indexOf(annotationName));
    }

    let row_mapping_high = [];
    let row_mapping_individuals = [];

    const num_row_ref = pathNames.indexOf("NC_045512");

    for (let num_row of all_visible) {
      //console.log(num_row + ' -- ' + pathNames[num_row] + ' ----- ' + all_annotation_num_rows.has(num_row))
      if (num_row !== num_row_ref) {
        if (all_annotation_num_rows.has(num_row)) {
          row_mapping_high.push(num_row);
        } else {
          row_mapping_individuals.push(num_row);
        }
      }
    }

    if (num_row_ref >= 0) {
      row_mapping_high.push(num_row_ref);
    }

    ordered_num_rows = row_mapping_high.concat(row_mapping_individuals);
  } else {
    ordered_num_rows = Array.from(all_visible).sort();
  }

  for (let [count, index] of ordered_num_rows.entries()) {
    row_mapping[index] = count;
  }

  return row_mapping;
}

const ComponentRect = observer(
  class extends React.Component {
    // state = {
    //   relativePixelX: this.props.item.relativePixelX,
    //   //   isSelected: this.props.store.isInSelection(this.props.item.firstCol,this.props.item.lastCol)
    // };

    constructor(props) {
      super(props);
    }

    handleClick = () => {
      // if (this.state.color === "lightgray") {
      //   this.setState({ color: "lightblue" });
      // } else if (this.state.color === "lightblue") {
      //   this.setState({ color: "lightgray" });
      // }
      if (this.isSelected) {
        // console.log("Deselected");
        this.props.store.delFromSelection(
          this.props.item.firstCol,
          this.props.item.lastCol
        );
      } else {
        // console.log("Selected");
        this.props.store.addToSelection(
          this.props.item.firstCol,
          this.props.item.lastCol
        );
      }
      // console.log(this.props.store.selectedComponents);
      // this.setState({isSelected: this.props.store.isInSelection(this.props.item.firstCol,this.props.item.lastCol)})
    };

    get isSelected() {
      return (
        this.props.store.selectedComponents.filter((val) => {
          return (
            (this.props.item.lastCol - val[0]) *
              (val[1] - this.props.item.firstCol) >
            0
          );
        }).length > 0
      );
    }

    renderMatrix() {
      let parts = values(this.props.item.matrix).map((entry) => {
        return this.renderMatrixRow(entry);
      });
      // this.props.store.updateMaxHeight(this.props.item.occupants.length); //Set max observed occupants in mobx store for render height
      return <>{parts}</>;
    }

    renderMatrixRow(entry) {
      // let this_y = verticalRank;
      // if (!this.props.store.useVerticalCompression) {
      //   if (!this.props.compressed_row_mapping.hasOwnProperty(uncompressed_y)) {
      //     return null; // we need compressed_y and we don't have it.  give up
      //   }
      //   this_y = this.props.compressed_row_mapping[uncompressed_y];
      // }
      let this_y = entry.pathID;

      let this_x;

      if (this.props.store.getBeginBin > this.props.item.firstBin) {
        this_x = this.props.item.relativePixelX;
      } else {
        this_x =
          this.props.item.relativePixelX +
          this.props.item.arrivals.size * this.props.store.pixelsPerColumn;
      }

      let pathName = this.props.store.chunkIndex.pathNames[entry.pathID];
      let rowColor = "#838383";
      if (this.props.store.colorByGeneAnnotation && this.props.store.metaData) {
        let metaData = this.props.store.metaData;
        if (metaData.get(pathName) !== undefined) {
          if (metaData.get(pathName).Color.startsWith("#")) {
            rowColor = metaData.get(pathName).Color;
          } else {
            rowColor = colorFromStr(metaData.get(pathName).Color);
          }
        }
      }
      // console.debug("[ComponentRect.renderMatrixRow] matrix entry", entry);

      return (
        <SpanCell
          key={"occupant" + this_y}
          entry={entry}
          parent={this.props.item}
          store={this.props.store}
          pathName={pathName}
          color={rowColor}
          x={this_x}
          y={
            this_y * this.props.store.pixelsPerRow + this.props.store.topOffset
          }
          rowNumber={this_y}
          handleClickMethod={this.handleClick}
        />
      );
    }

    renderAllConnectors() {
      // debugger;

      let connectorsColumn = this.props.item.connectorLink;

      if (connectorsColumn === null) {
        return null;
      }

      //count starts at the sum(sum(departure columns)) so that it's clear
      // adjacent connectors are alternatives to LinkColumns
      //offset the y to start below link columns when using vertical compression
      // let yOffset = values(departures)
      //   .slice(0, -1)
      //   .map((column) => {
      //     return column.participants.length;
      //   })
      //   .reduce(sum, 0); // sum of trues in all columns
      return (
        <>
          {connectorsColumn.participants.map((uncompressed_row) => {
            {
              /*yOffset++; // only used in vertical compression*/
            }
            return this.renderComponentConnector(uncompressed_row);
          })}
        </>
      );
    }

    renderSeparators() {
      const lines = [];
      // console.log("Departures:",this.props.item.departures)
      // console.log("Arrivals:",this.props.item.arrivals)
      for (
        let h = 0;
        h <= this.props.height;
        h += this.props.store.pixelsPerRow
      ) {
        lines.push(
          <Line
            points={[
              this.props.item.relativePixelX,
              this.props.store.topOffset + h,
              this.props.item.relativePixelX +
                this.props.widthInColumns * this.props.store.pixelsPerColumn,
              this.props.store.topOffset + h,
            ]}
            stroke={"black"}
            strokeWidth={1}
            key={"LineHeight" + h}
          />
        );
      }
      return <>{lines}</>;
    }

    // isSelected() {
    //   console.log("Selected components: ",this.props.store.selectedComponents);
    //   return true;
    // }

    renderSelectedMarker() {
      return (
        <>
          <Line
            points={[
              this.props.item.relativePixelX,
              this.props.store.topOffset,
              this.props.item.relativePixelX,
              this.props.store.topOffset + this.props.height - 1,
            ]}
            stroke={"red"}
            strokeWidth={2}
            key={"LeftSelectionMarker"}
          />
          <Line
            points={[
              this.props.item.relativePixelX +
                this.props.widthInColumns * this.props.store.pixelsPerColumn,
              this.props.store.topOffset,
              this.props.item.relativePixelX +
                this.props.widthInColumns * this.props.store.pixelsPerColumn,
              this.props.store.topOffset + this.props.height - 1,
            ]}
            stroke={"red"}
            strokeWidth={2}
            key={"RightSelectionMarker"}
          />
        </>
      );
    }

    renderZoomBoundary() {
      const lines = [];
      if (this.props.store.zoomHighlightBoundaries.length === 2) {
        // console.log("[ComponentRect.renderZoomBoundary] left zoom boundary",this.props.store.zoomHighlightBoundaries[0])
        // console.log("[ComponentRect.renderZoomBoundary] right zoom boundary",this.props.store.zoomHighlightBoundaries[1])
        // debugger;
        if (
          this.props.item.firstBin <=
            this.props.store.zoomHighlightBoundaries[0] &&
          this.props.item.lastBin >= this.props.store.zoomHighlightBoundaries[0]
        ) {
          // console.log("[ComponentRect.renderZoomBoundary] start zoom boundary is in component",this.props.item)
          let xPos =
            this.props.item.relativePixelX +
            (this.props.item.arrivals.size +
              (this.props.store.zoomHighlightBoundaries[0] -
                this.props.item.firstBin)) *
              this.props.store.pixelsPerColumn;
          lines.push(
            <Line
              points={[
                xPos,
                this.props.store.topOffset,
                xPos,
                this.props.store.topOffset + this.props.height - 1,
              ]}
              stroke={"red"}
              strokeWidth={4}
              key={"LeftZoomMarker"}
            />
          );
        }

        if (
          this.props.item.firstBin <=
            this.props.store.zoomHighlightBoundaries[1] &&
          this.props.item.lastBin >= this.props.store.zoomHighlightBoundaries[1]
        ) {
          // console.log("[ComponentRect.renderZoomBoundary] end zoom boundary is in component",this.props.item)
          let xPos =
            this.props.item.relativePixelX +
            (this.props.item.arrivals.size +
              (this.props.store.zoomHighlightBoundaries[1] -
                this.props.item.firstBin +
                1)) *
              this.props.store.pixelsPerColumn;
          lines.push(
            <Line
              points={[
                xPos,
                this.props.store.topOffset,
                xPos,
                this.props.store.topOffset + this.props.height - 1,
              ]}
              stroke={"red"}
              strokeWidth={4}
              key={"RightZoomMarker"}
            />
          );
        }
        window.setTimeout(() => {
          this.props.store.clearZoomHighlightBoundaries();
        }, 10000);
      }
      return <>{lines}</>;
    }

    renderComponentConnector(this_y) {
      // debugger;
      let component = this.props.item;
      // x is the (num_bins + num_arrivals + num_departures)*pixelsPerColumn
      const x_val =
        this.props.item.relativePixelX +
        (component.arrivals.size +
          (this.props.store.useWidthCompression
            ? this.props.store.binScalingFactor
            : component.numBins) +
          component.departures.size -
          1) *
          this.props.store.pixelsPerColumn;

      // if (!this.props.store.useVerticalCompression) {
      //   this_y = this.props.compressed_row_mapping[uncompressedRow];
      // }
      return (
        <ConnectorRect
          key={"connector" + this_y}
          x={x_val}
          y={
            this.props.store.topOffset + this_y * this.props.store.pixelsPerRow
          }
          width={this.props.store.pixelsPerColumn} //Clarified and corrected adjacent connectors as based on pixelsPerColumn width #9
          height={this.props.store.pixelsPerRow}
          color={"#AAAABE"}
        />
      );
    }
    // componentDidUpdate(prevProps) {
    //   console.log("[ComponentRect.componentDidUpdate] prevProps", prevProps,
    //     " new props ", this.props,
    //     " current state ", this.state.relativePixelX)
    //   this.forceUpdate()
    //   // if (prevProps.item.relativePixelX !== this.props.item.relativePixelX) {
    //   //   this.setState({relativePixelX: this.props.item.relativePixelX})
    //   // }
    // }

    render() {
      // console.debug("[ComponentRect.render] component to render", this.props.item)
      // console.debug("[ComponentRect.render] relativePixelX", this.props.item.relativePixelX)
      // console.debug("[ComponentRect.render] widthInColumns", this.props.widthInColumns)
      // console.debug("[ComponentRect.render] height", this.props.height)
      if (this.props.store.visualisedComponents.size === 0) {
        return null;
      }
      return (
        <>
          <Rect
            x={this.props.item.relativePixelX}
            y={
              this.props.store.topOffset +
              (this.props.store.maxArrowHeight + 2) *
                this.props.store.pixelsPerColumn
            }
            key={this.props.item.index + "R"}
            width={this.props.widthInColumns * this.props.store.pixelsPerColumn}
            height={this.props.height - 2} //TODO: change to compressed height
            fill={this.isSelected ? "lightblue" : "lightgray"}
            onClick={this.handleClick}
            onMouseOver={this.onHover.bind(this)}
            onMouseLeave={this.onLeave.bind(this)}
          />
          {!this.props.store.useWidthCompression ? this.renderMatrix() : null}
          {this.props.store.useConnector ? this.renderAllConnectors() : null}
          {this.renderSeparators()}
          {this.isSelected ? this.renderSelectedMarker() : null}
          {this.props.store.zoomHighlightBoundaries.length === 2
            ? this.renderZoomBoundary()
            : null}
        </>
      );
    }

    onHover(event) {
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

ComponentRect.propTypes = {
  store: PropTypes.object,
  item: PropTypes.object,
  compressed_row_mapping: PropTypes.object,
  widthInColumns: PropTypes.number,
  height: PropTypes.number,
  pathNames: PropTypes.node,
};

export default ComponentRect;
