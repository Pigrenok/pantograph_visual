import React from "react";
import { Text } from "react-konva";
import { observer } from "mobx-react";

const ConnectorRect = observer(
  class extends React.Component {
    // This React component draws connector arrows (continuity arrows) where they are needed.
    constructor(props) {
      super(props);
    }

    render() {
      if (!this.props.store.components.has(this.props.itemIndex)) {
        return null;
      }
      let x_val = this.props.item.relativePixelX;
      // x is the (num_bins + num_arrivals + num_departures)*pixelsPerColumn
      let numCols;

      if (this.props.isRight) {
        if (this.props.item.firstBin < this.props.store.getBeginBin) {
          x_val +=
            (this.props.item.numBins -
              (this.props.store.getBeginBin - this.props.item.firstBin)) *
            this.props.store.pixelsPerColumn;
        } else {
          x_val +=
            ((this.props.item.arrivalVisible
              ? this.props.item.leftLinkSize
              : 0) +
              this.props.item.numBins) *
            this.props.store.pixelsPerColumn;
        }
        numCols = this.props.item.rightLinkSize;
      } else {
        numCols = this.props.item.leftLinkSize;
      }

      let y =
        this.props.store.maxArrowHeight * this.props.store.pixelsPerColumn +
        this.props.participant * this.props.store.pixelsPerRow;

      let connectingRow = [];

      let arrow = this.props.isInverse ? "<" : ">";

      for (let c = 0; c < numCols; c++) {
        connectingRow.push(
          <Text
            key={
              this.props.item.index +
              "_" +
              this.props.participant.toString() +
              "-" +
              (this.props.isRight ? "r_" : "l_") +
              (this.props.isInverse ? "inv_" : "") +
              c.toString()
            }
            x={x_val + c * this.props.store.pixelsPerColumn}
            y={y}
            height={this.props.store.pixelsPerRow}
            width={this.props.store.pixelsPerColumn}
            align={"center"}
            verticalAlign={"middle"}
            text={arrow}
            fontSize={Math.min(
              this.props.store.pixelsPerColumn,
              this.props.store.pixelsPerRow
            )}
          />
        );
      }

      return <>{connectingRow}</>;
    }
  }
);

export default ConnectorRect;
