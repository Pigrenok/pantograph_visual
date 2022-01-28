import React from "react";
import MouseTooltip from "react-sticky-mouse-tooltip";
import { observer } from "mobx-react";
import PropTypes from "prop-types";

const NucleotideTooltip = observer(
  class extends React.Component {
    render() {
      let offsetX =
        this.props.store.mouseX + 150 >= this.props.store.windowWidth
          ? -150
          : 15;

      return (
        <MouseTooltip
          visible={this.props.store.cellToolTipContent != ""}
          offsetX={offsetX}
          offsetY={20}
          style={{ background: "white", zIndex: 4, whiteSpace: "pre-line" }}
        >
          <span>{this.props.store.cellToolTipContent}</span>
        </MouseTooltip>
      );
    }
  }
);

NucleotideTooltip.propTypes = {
  store: PropTypes.object,
};

export default NucleotideTooltip;
