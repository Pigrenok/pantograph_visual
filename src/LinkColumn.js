import React from "react";
import { Rect, Arrow } from "react-konva";
import { observer } from "mobx-react";
import PropTypes from "prop-types";
import {
  range,
  stringToColorAndOpacity,
  arraysEqual,
  linkKey,
} from "./utilities";
import { values } from "mobx";
import ConnectorRect from "./ComponentConnectorRect";

const LinkColumn = observer(
  class extends React.Component {
    constructor(props) {
      super(props);
      this.handleMouseOut = this.handleMouseOut.bind(this);
      this.handleMouseOver = this.handleMouseOver.bind(this);
      this.handleClick = this.handleClick.bind(this);
    }

    handleMouseOver(pathID) {
      // console.debug("[LinkColumn.handleMouseOver] pathID", pathID);
      if (pathID) {
        this.props.store.updateCellTooltipContent(
          `Accession ${this.props.store.chunkIndex.pathNames[pathID]} \n From bin ${this.props.item.upstream}\nTo bin ${this.props.item.downstream}`
        );
      } else {
        this.props.store.updateCellTooltipContent(
          `From bin ${this.props.item.upstream}\nTo bin ${this.props.item.downstream}`
        );
      }

      this.props.store.updateHighlightedLink(this.props.item);
      if (pathID != undefined) {
        this.props.store.setHighlightedAccession(pathID);
      }
    }

    handleMouseOut() {
      this.props.store.updateCellTooltipContent("");
      this.props.store.updateHighlightedLink(null);
      this.props.store.clearHighlightedAccession();
    }

    handleClick() {
      let centreBin;
      let highlightedLink = null;
      // if (this.props.store.highlightedLink) {
      //   highlightedLink = this.props.store.highlightedLink.key;
      // }

      if (this.props.item.key[0] === "d") {
        // departure
        centreBin = this.props.item.downstream;
        // if (highlightedLink) {
        //   highlightedLink = "a" + highlightedLink.slice(1);
        // }
      }

      if (this.props.item.key[0] === "a") {
        //arrival
        centreBin = this.props.item.upstream;
        // if (highlightedLink) {
        //   highlightedLink = "d" + highlightedLink.slice(1);
        // }
      }

      let linkToRight;

      if (this.props.item.upstream < this.props.item.downstream) {
        //Arrow to the right
        linkToRight = 1;
      } else if (this.props.item.upstream > this.props.item.downstream) {
        //Arrow to the left
        linkToRight = -1;
      } else {
        // Self loop on single bin component
        // do nothing with loaded components.
        linkToRight = 0;
      }
      this.props.store.updatePosition(
        centreBin,
        this.props.store.highlightedLink
      );
    }

    points() {
      // if (this.props.item.downstream===16) {
      //   debugger;
      // }
      let parentZoomLevel = this.props.parent.zoom_level;
      if (
        this.props.item.key[0] === "d"
        //  &&
        // this.props.item.downstream - this.props.item.upstream != 1 //This condition correct only for both forward blocks.
        // Remove it from here
        //Some of the info can be obtained from above (App.renderComponentLinks)
      ) {
        // departure

        let arrowPoints = [
          0.5 * this.props.store.pixelsPerColumn,
          this.props.store.pixelsPerColumn,
          0.5 * this.props.store.pixelsPerColumn,
          0,
        ];

        let dComp = this.props.store.linkInView(
          this.props.item.downstream,
          parentZoomLevel
        );
        //Check directionality of both upstream and downstream and then decide where to put arrows or not.
        // console.debug("[LinkColumn.points] this.props.item", this.props.item);
        // console.debug("[LinkColumn.points] this.props", this.props);
        // console.debug("[LinkColumn.points] dComp", dComp);
        if (
          dComp &&
          this.props.item.downstream >= this.props.store.getBeginBin &&
          this.props.item.downstream <= this.props.store.getEndBin
        ) {
          //downstream in view
          let arrivalKey =
            "a" +
            this.props.item.key.slice(1, this.props.item.key.length - 3) +
            (this.props.side === "right" ? "osr" : "osl");
          // console.debug("[LinkColumn.points] link", this.props.item);

          // console.debug("[LinkColumn.points] arrivalKey", arrivalKey);
          let dLink;
          let dOffset = 0;
          if (this.props.item.otherSideRight) {
            dLink = dComp.rarrivals.get(arrivalKey);
            if (dComp.firstBin >= this.props.store.getBeginBin) {
              dOffset =
                (dComp.arrivalVisible ? dComp.leftLinkSize : 0) + dComp.numBins;
            } else {
              dOffset = dComp.lastBin - this.props.store.getBeginBin + 1;
            }
            if (
              this.props.side === "left" &&
              this.props.item.upstream - this.props.item.downstream === 1
            ) {
              return [];
            }
          } else {
            dLink = dComp.larrivals.get(arrivalKey);
            if (
              this.props.side === "right" &&
              this.props.item.downstream - this.props.item.upstream === 1
            ) {
              return [];
            }
          }
          // console.debug("[LinkColumn.points] dComp", dComp);
          // console.debug("[LinkColumn.points] dLink", dLink);

          if (dComp === undefined || dLink == undefined) {
            debugger;
          }

          let dX =
            dComp.relativePixelX +
            (dLink.order + dOffset) * this.props.store.pixelsPerColumn -
            this.props.x;
          arrowPoints = arrowPoints.concat([
            0.5 * this.props.store.pixelsPerColumn,
            -1 *
              (this.props.item.elevation + 1.5) *
              this.props.store.pixelsPerColumn,
            dX + 0.5 * this.props.store.pixelsPerColumn,
            -1 *
              (this.props.item.elevation + 1.5) *
              this.props.store.pixelsPerColumn,
            dX + 0.5 * this.props.store.pixelsPerColumn,
            0,
          ]);
        }

        return arrowPoints;
      }

      if (this.props.item.key[0] === "a") {
        //arrival
        let upstreamComp = this.props.store.linkInView(
          this.props.item.upstream,
          parentZoomLevel
        );
        if (upstreamComp) {
          // Check here if the other side is forward ir reverse and check if right or left edge is visible then!!!
          if (upstreamComp.departureVisible) {
            //upstream in view
            return [];
          }
        }
        return [
          0.5 * this.props.store.pixelsPerColumn,
          -1 * this.props.store.pixelsPerColumn,
          0.5 * this.props.store.pixelsPerColumn,
          0,
        ];
      }

      return [];
    }

    renderArrow(points, color, opacity) {
      let arrowOpacity = opacity;
      if (this.props.store.doHighlightRows) {
        if (this.props.store.highlightedAccession != null) {
          if (
            !this.props.item.participants.includes(
              this.props.store.highlightedAccession
            )
          ) {
            arrowOpacity = 0.3;
          }
        }
      }

      return (
        <Arrow
          x={this.props.x}
          y={this.props.y - this.props.store.pixelsPerColumn}
          // width={this.props.store.pixelsPerColumn}
          points={points}
          bezier={false}
          strokeWidth={this.props.store.pixelsPerColumn - 2}
          fill={color}
          stroke={color}
          opacity={arrowOpacity}
          // stroke-opacity={this.props.opacity}
          pointerLength={1}
          pointerWidth={1}
          tension={0}
          onMouseOver={() => {
            this.handleMouseOver();
          }}
          onMouseOut={this.handleMouseOut}
          onClick={this.handleClick}
          // lineCap={'round'}
        />
      );
    }

    checkSingleReverse() {
      //Link from first component to second component

      let compLinks;
      let linkKeyToSearch;

      let isRight;

      // debugger;

      // if (this.props.item.key.slice(0, 1) === "d") {
      // arrival
      if (this.props.item.key.slice(this.props.item.key.length - 3) === "osr") {
        // othe side right
        // check for edge case of upstream == last_bin_pangenome
        let comp = this.props.store.compByBin(
          this.props.item.upstream + 1,
          this.props.parent.zoom_level
        );
        if (comp === undefined) {
          return true;
        }
        compLinks = comp.ldepartures;
        linkKeyToSearch = linkKey(
          "d",
          this.props.item.downstream + 1,
          this.props.item.upstream + 1,
          false
        );
        isRight = true;
      } else {
        // other side left
        // check for edge case of downstream == 1
        let comp = this.props.store.compByBin(
          this.props.item.downstream - 1,
          this.props.parent.zoom_level
        );
        if (comp === undefined) {
          return true;
        }

        compLinks = this.props.store.compByBin(
          this.props.item.downstream - 1,
          this.props.parent.zoom_level
        ).rarrivals;
        linkKeyToSearch = linkKey(
          "a",
          this.props.item.downstream - 1,
          this.props.item.upstream - 1,
          true
        );
        isRight = false;
      }

      if (
        compLinks.has(linkKeyToSearch) &&
        arraysEqual(
          this.props.item.participants,
          compLinks.get(linkKeyToSearch).participants
        )
      ) {
        if (
          (this.props.side == "left" && this.props.parent.arrivalVisible) ||
          (this.props.side == "right" && this.props.parent.departureVisible)
        ) {
          return (
            <>
              {this.props.item.participants.map((item) => (
                <ConnectorRect
                  participant={item}
                  item={this.props.parent}
                  itemIndex={this.props.parent.index}
                  store={this.props.store}
                  isRight={isRight}
                  isInverse={false}
                />
              ))}
            </>
          );
        } else {
          return null;
        }
      }

      return true;
    }

    render() {
      //const contents = this.linkCells();

      if (this.props.store.chunkLoading) {
        return null;
      }

      if (this.props.store.hideInversionLinks) {
        let res = this.checkSingleReverse();

        if (res !== true) {
          return res;
        }
      }

      let [localColor, localOpacity, localStroke] = stringToColorAndOpacity(
        this.props.item,
        this.props.store.highlightedLink
      );

      if (this.props.store.preferHighlight) {
        if (this.props.store.highlightedAccession == null) {
          localOpacity = 0.3;
        }
      }

      let points = this.points();
      // console.debug("[LinkColumn.render] x,y",this.props.x,this.props.store.topOffset - 2*this.props.store.pixelsPerColumn)
      // console.debug("[LinkColumn.render] points",points)
      return (
        <>
          {points.length > 0
            ? this.renderArrow(points, localColor, localOpacity)
            : null}
          {this.props.item.participants.map((pathID) => {
            let rowOpacity = localOpacity;
            if (this.props.store.doHighlightRows) {
              if (this.props.store.highlightedAccession != null) {
                if (this.props.store.highlightedAccession != pathID) {
                  rowOpacity = 0.3;
                } else {
                  rowOpacity = 1.0;
                }
              }
            }
            return (
              <Rect
                key={"dot" + pathID}
                x={this.props.x}
                y={this.props.y + pathID * this.props.store.pixelsPerRow + 1}
                width={this.props.store.pixelsPerColumn - 1}
                height={this.props.store.pixelsPerRow - 2}
                fill={localColor}
                opacity={rowOpacity}
                stroke={localStroke}
                // onClick={this.handleClick}
                onMouseOver={() => this.handleMouseOver(pathID)}
                onMouseOut={this.handleMouseOut}
                onClick={this.handleClick}
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
