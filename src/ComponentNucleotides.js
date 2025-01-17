import React from "react";
import { Text } from "react-konva";
import { observer } from "mobx-react";

const ComponentNucleotides = observer(
  class extends React.Component {
    // React components for shwoing nucleotides where they are available,
    renderMatrixRow() {
      if (this.props.store.components.size === 0) {
        return null;
      }

      const parent = this.props.item;
      let x_val = parent.relativePixelX;
      let startPos = 0;

      if (parent.firstBin < this.props.store.getBeginBin) {
        startPos = this.props.store.getBeginBin - parent.firstBin;
      } else {
        x_val +=
          (parent.arrivalVisible ? parent.leftLinkSize : 0) *
          this.props.store.pixelsPerColumn;
      }

      let numBins = this.props.item.numBins;
      if (parent.lastBin > this.props.store.getEndBin) {
        numBins -= parent.lastBin - this.props.store.getEndBin;
      }

      let listOfObjects = [];
      for (var x = startPos; x < numBins; x++) {
        listOfObjects.push(
          <Text
            key={"nuc_text" + x}
            x={x_val + (x - startPos) * this.props.store.pixelsPerColumn}
            y={this.props.y - this.props.store.pixelsPerColumn}
            text={this.props.nucleotides[x]}
            align="center"
            height={this.props.store.pixelsPerColumn}
            width={this.props.store.pixelsPerColumn}
            fontSize={this.props.store.pixelsPerColumn + 2}
          />
        );
      }
      return listOfObjects;
    }

    render() {
      return this.renderMatrixRow();
    }
  }
);

export default ComponentNucleotides;
