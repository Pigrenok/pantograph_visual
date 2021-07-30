import React from "react";
import { Rect, Text } from "react-konva";
import PropTypes from "prop-types";

export class ConnectorRect extends React.Component {
  render() {
    let colour;
    if (this.props.isToRight) {
      colour = "#AAAABE";
    } else {
      colour = "#FF6B6B";
    }

    return (
      <>
        <Rect
          x={this.props.x}
          y={this.props.y}
          width={this.props.width}
          height={this.props.height || 1}
          fill={colour}
        />
        <Text
          x={this.props.x}
          y={this.props.y}
          width={this.props.width}
          height={this.props.height || 1}
          align={"center"}
          verticalAlign={"center"}
          text={this.props.isToRight ? ">" : "<"}
        />
      </>
    );
  }
}

ConnectorRect.propTypes = {
  x: PropTypes.number,
  y: PropTypes.number,
  width: PropTypes.number,
  height: PropTypes.number,
  store: PropTypes.node,
  color: PropTypes.node,
};
