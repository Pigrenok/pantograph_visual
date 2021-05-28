import React from "react";
import { Rect, Arrow } from "react-konva";
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
    handleMouseOver(pathID) {
      this.props.store.updateHighlightedLink(this.props.item);
      this.props.store.updateCellTooltipContent(
        `Accession ${this.props.store.chunkIndex.pathNames[pathID]} \n From bin ${this.props.item.upstream}\nTo bin ${this.props.item.downstream}`
      );
    }
    handleMouseOut() {
      this.props.store.updateHighlightedLink(null);
      this.props.store.updateCellTooltipContent("");
    }
    // linkCells() {
    //   if (!this.props.store.useVerticalCompression) {
    //     //regular layout
    //     return this.props.item.participants.map(
    //       (pathIndex) => pathIndex * this.props.store.pixelsPerRow
    //     );
    //   }
    //   //else, just stack each up at the top of the screen
    //   return range(0, this.props.item.participants.length).map(
    //     (y) => y * this.props.store.pixelsPerRow
    //   );
    // }
    // componentDidMount() {
    //   this.setState({
    //     color: this.props.color,
    //   });
    // }

    points() {
      if (this.props.item.upstream === this.props.parent.lastBin) {
        // departure
        let arrowPoints = [
          5,
          this.props.store.pixelsPerColumn,
          5,
          -1 * this.props.store.pixelsPerColumn,
        ];
        if (
          this.props.store.visualisedComponents.has(
            this.props.item.downstream
          ) &&
          this.props.parent.lastBin < this.props.store.getEndBin
        ) {
          //upstream in view
          let dComp = this.props.store.visualisedComponents.get(
            this.props.item.downstream
          );
          if (dComp.firstBin >= this.props.store.getBeginBin) {
            let dLink = dComp.arrivals.get("a" + this.props.item.key.slice(1));
            let dX =
              dComp.relativePixelX +
              dLink.order * this.props.store.pixelsPerColumn -
              this.props.x;
            arrowPoints = arrowPoints.concat([
              5,
              -1 *
                (this.props.item.elevation + 2) *
                this.props.store.pixelsPerColumn,
              dX + 5,
              -1 *
                (this.props.item.elevation + 2) *
                this.props.store.pixelsPerColumn,
              dX + 5,
              0,
            ]);
          } else {
            arrowPoints[3] = -1;
          }
        } else {
          arrowPoints[3] = -1;
        }

        return arrowPoints;
      }

      if (this.props.item.downstream === this.props.parent.firstBin) {
        //arrival
        if (
          this.props.store.visualisedComponents.has(this.props.item.upstream)
        ) {
          //upstream in view
          return [];
        }

        return [5, -1 * this.props.store.pixelsPerColumn, 5, 0];
      }

      return [];
    }

    renderArrow(points) {
      console.debug(
        "[LinkColumn.renderArrow] x,y",
        this.props.x,
        this.props.store.topOffset - this.props.store.pixelsPerColumn
      );
      console.debug(
        "[LinkColumn.renderArrow] elevation",
        this.props.item.elevation
      );
      console.debug("[LinkColumn.renderArrow] points", points);
      console.debug(
        "[LinkColumn.renderArrow] arrow condition",
        points.length > 0
      );
      return (
        <Arrow
          x={this.props.x}
          y={this.props.store.topOffset - this.props.store.pixelsPerRow}
          // width={this.props.store.pixelsPerColumn}
          points={points}
          bezier={false}
          strokeWidth={this.props.store.pixelsPerColumn}
          fill={this.props.color}
          stroke={this.props.color}
          opacity={this.props.opacity}
          // stroke-opacity={this.props.opacity}
          pointerLength={1}
          pointerWidth={1}
          tension={0}
          // onMouseOver={this.handleMouseOver}
          // onMouseOut={this.handleMouseOut}
          // onClick={this.handleClick}
          // lineCap={'round'}
        />
      );
    }

    render() {
      //const contents = this.linkCells();
      // debugger;

      if (this.props.store.visualisedComponents.size === 0) {
        return null;
      }

      let points = this.points();
      // console.debug("[LinkColumn.render] x,y",this.props.x,this.props.store.topOffset - 2*this.props.store.pixelsPerColumn)
      // console.debug("[LinkColumn.render] points",points)
      // console.debug("[LinkColumn.render] arrow condition",points.length>0)
      return (
        <>
          {points.length > 0 ? this.renderArrow(points) : null}
          {this.props.item.participants.map((pathID) => {
            return (
              <Rect
                key={"dot" + pathID}
                x={this.props.x}
                y={
                  this.props.store.topOffset +
                  pathID * this.props.store.pixelsPerRow
                }
                width={this.props.store.pixelsPerColumn - 1}
                height={this.props.store.pixelsPerRow}
                fill={this.props.color}
                opacity={this.props.opacity}
                stroke={this.props.stroke}
                // onClick={this.handleClick}
                onMouseOver={() => this.handleMouseOver(pathID)}
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
