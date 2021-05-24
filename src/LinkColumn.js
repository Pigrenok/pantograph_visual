import React from "react";
import { Rect } from "react-konva";
import { observer } from "mobx-react";
import PropTypes from "prop-types";
import { range } from "./utilities";

const LinkColumn = observer(
  class extends React.Component {
    constructor(props) {
      super(props);
      this.handleMouseOut = this.handleMouseOut.bind(this);
      this.handleMouseOver = this.handleMouseOver.bind(this);
    }
    handleMouseOver() {
      this.props.store.updateHighlightedLink(this.props.item);
      this.props.store.updateCellTooltipContent(
        `From bin ${this.props.item.upstream}\nTo bin ${this.props.item.downstream}`
      );
    }
    handleMouseOut() {
      this.props.store.updateHighlightedLink(null);
      this.props.store.updateCellTooltipContent("");
    }
    linkCells() {
      if (!this.props.store.useVerticalCompression) {
        //regular layout
        return this.props.item.participants.map(
          (pathIndex) => pathIndex * this.props.store.pixelsPerRow
        );
      }
      //else, just stack each up at the top of the screen
      return range(0, this.props.item.participants.length).map(
        (y) => y * this.props.store.pixelsPerRow
      );
    }
    componentDidMount() {
      this.setState({
        color: this.props.color,
      });
    }
    render() {
      const contents = this.linkCells();
      return (
        <>
          {contents.map((y_coord, d) => {
            return (
              <Rect
                key={"dot" + d}
                x={this.props.x + 1}
                y={this.props.store.topOffset + y_coord}
                width={this.props.store.pixelsPerColumn - 1}
                height={this.props.store.pixelsPerRow}
                fill={this.props.color}
                opacity={this.props.opacity}
                stroke={this.props.stroke}
                // onClick={this.handleClick}
                onMouseOver={this.handleMouseOver}
                onMouseOut={this.handleMouseOut}
              />
            );
          })}
        </>
      );
    }
  }
);

LinkColumn.propTypes = {
  store: PropTypes.object,
  item: PropTypes.object,
  updateHighlightedNode: PropTypes.func,
  compressed_row_mapping: PropTypes.object,
  x: PropTypes.node,
  column: PropTypes.node,
  color: PropTypes.node,
};

export default LinkColumn;
