import React from "react";
import MouseTooltip from "react-sticky-mouse-tooltip";
import { observer } from "mobx-react";

const NucleotideTooltip = observer(
  class extends React.Component {
    // This very simple class is a component which implement mouse tool tip for our view.
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

export default NucleotideTooltip;
