import React from "react";
import { Text } from "react-konva";
import PropTypes from "prop-types";
import { observer } from "mobx-react";

const ComponentNucleotides = observer(
  class extends React.Component {
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
        x_val += parent.arrivals.size * this.props.store.pixelsPerColumn;
      }

      console.debug("[ComponentNucleotides.renderMatrixRow] x_val: ", x_val);
      console.debug(
        "[ComponentNucleotides.renderMatrixRow] heightArray: ",
        this.props.store.arrowHeight
      );
      let listOfObjects = [];
      for (var x = startPos; x < this.props.item.numBins; x++) {
        listOfObjects.push(
          <Text
            key={"nuc_text" + x}
            x={x_val + (x - startPos) * this.props.store.pixelsPerColumn}
            y={1.7 * this.props.store.pixelsPerColumn}
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
      //console.log('ComponentNucleotides - render')
      return this.renderMatrixRow();
    }
  }
);

ComponentNucleotides.propTypes = {
  store: PropTypes.object,
  item: PropTypes.object,
};

export default ComponentNucleotides;
