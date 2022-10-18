import React from "react";
import { Rect, Text } from "react-konva";
import { observer } from "mobx-react";
import PropTypes from "prop-types";

const ConnectorRect = observer(
  class extends React.Component {
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
        (this.props.store.maxArrowHeight + this.props.participant) *
        this.props.store.pixelsPerColumn;

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
            width={this.props.store.pixelsPerColumn}
            height={this.props.store.pixelsPerRow}
            align={"center"}
            verticalAlign={"center"}
            text={arrow}
          />
        );
      }

      return <>{connectingRow}</>;
    }
  }
);

export default ConnectorRect;

// ConnectorRect.propTypes = {
//   x: PropTypes.number,
//   y: PropTypes.number,
//   width: PropTypes.number,
//   height: PropTypes.number,
//   store: PropTypes.node,
//   color: PropTypes.node,
// };
