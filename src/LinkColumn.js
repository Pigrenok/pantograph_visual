import React from "react";
import { Rect, Arrow } from "react-konva";
import { observer } from "mobx-react";
import PropTypes from "prop-types";
import { range, stringToColorAndOpacity, arraysEqual } from "./utilities";
import { values } from "mobx";
import { ConnectorRect } from "./ComponentConnectorRect";

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
      this.props.store.setHighlightedAccession(pathID);
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
      this.props.store.jumpToCentre(
        centreBin,
        linkToRight,
        this.props.store.highlightedLink
      );
    }

    points() {
      // if (this.props.parent.firstBin === 2) {
      //   debugger;
      // }
      // if (this.props.item.upstream==214 && this.props.item.downstream==169) {
      //   debugger;
      // }
      if (
        this.props.item.key[0] === "d"
        //  &&
        // this.props.item.downstream - this.props.item.upstream != 1 //This condition correct only for both forward blocks.
        // Remove it from here
        //Some of the info can be obtained from above (App.renderComponentLinks)
      ) {
        // departure

        // if (this.props.parent.firstBin==64 || this.props.parent.firstBin==122 || this.props.parent.firstBin==123) {
        //   debugger;
        // }

        let arrowPoints = [
          0.5 * this.props.store.pixelsPerColumn,
          this.props.store.pixelsPerColumn,
          0.5 * this.props.store.pixelsPerColumn,
          0,
        ];

        let dComp = this.props.store.linkInView(this.props.item.downstream);
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
              dOffset = dComp.leftLinkSize + dComp.numBins;
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
        // if (this.props.item.downstream === 492) {
        //   debugger;
        // }
        let upstreamComp = this.props.store.linkInView(
          this.props.item.upstream
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
            arrowOpacity = 0.1;
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
      // if (this.props.item.upstream===63 && this.props.item.downstream===56 ||
      //   this.props.item.upstream===64 && this.props.item.downstream==57) {
      //   debugger;
      // }

      let otherSideBin;
      if (this.props.item.key.slice(0, 1) === "d") {
        otherSideBin = this.props.item.downstream;
      } else {
        otherSideBin = this.props.item.upstream;
      }

      if (
        this.props.side === "right" &&
        this.props.item.key.slice(this.props.item.key.length - 3) === "osr" //&&
        // this.props.item.key.slice(0, 1) === "d"
      ) {
        // debugger;

        let dComp = this.props.store.linkInView(otherSideBin);

        // First Component side
        if (dComp && dComp.firstBin - 1 === this.props.parent.lastBin) {
          // If the other side is in view.

          let otherSideLinks;
          if (this.props.item.key.slice(0, 1) === "d") {
            otherSideLinks = dComp.ldepartures;
          } else {
            otherSideLinks = dComp.larrivals;
          }

          for (let link of values(otherSideLinks)) {
            if (
              arraysEqual(link.participants, this.props.item.participants) &&
              !link.otherSideRight &&
              ((link.downstream - 1 === dComp.lastBin &&
                this.props.item.key.slice(0, 1) === "d") ||
                (link.upstream - 1 === dComp.lastBin &&
                  this.props.item.key.slice(0, 1) === "a"))
            ) {
              return null;
            }
          }
        }

        //Second component side
        if (dComp && dComp.lastBin + 1 === this.props.parent.firstBin) {
          // If the other side is in view.

          let otherSideLinks;
          if (this.props.item.key.slice(0, 1) === "a") {
            otherSideLinks = this.props.parent.ldepartures;
          } else {
            otherSideLinks = this.props.parent.larrivals;
          }

          for (let link of values(otherSideLinks)) {
            if (
              arraysEqual(link.participants, this.props.item.participants) &&
              !link.otherSideRight &&
              // Change downstream to upstream for departure case.
              ((link.downstream - 1 === this.props.parent.lastBin &&
                this.props.item.key.slice(0, 1) === "a") ||
                (link.upstream - 1 === this.props.parent.lastBin &&
                  this.props.item.key.slice(0, 1) === "d"))
            ) {
              return this.props.item.participants.map((item) => (
                <ConnectorRect
                  key={"connector" + this.props.item.index + item}
                  x={
                    this.props.parent.relativePixelX -
                    this.props.store.pixelsPerColumn
                  }
                  y={this.props.y + item * this.props.store.pixelsPerRow}
                  width={this.props.store.pixelsPerColumn} //Clarified and corrected adjacent connectors as based on pixelsPerColumn width #9
                  height={this.props.store.pixelsPerRow}
                  isToRight={this.props.item.key.slice(0, 1) === "a"}
                />
              ));

              //Add connector here
              // return null;
            }
          }
        }

        // Check if there is a link in view and from next component to after next component the link is from left to left,
        //then do not draw this arrow.
      }

      //link from second component to third component.
      if (
        this.props.side === "left" &&
        // this.props.item.key.slice(0, 1) === "d" &&
        this.props.item.key.slice(this.props.item.key.length - 3) === "osl"
      ) {
        // debugger;

        let dComp = this.props.store.linkInView(otherSideBin);

        //Second component side
        if (dComp && dComp.firstBin - 1 === this.props.parent.lastBin) {
          // If the other side is in view.

          let otherSideLinks;
          if (this.props.item.key.slice(0, 1) === "d") {
            otherSideLinks = this.props.parent.rarrivals;
          } else {
            otherSideLinks = this.props.parent.rdepartures;
          }

          for (let link of values(otherSideLinks)) {
            if (
              arraysEqual(link.participants, this.props.item.participants) &&
              link.otherSideRight &&
              ((link.downstream + 1 === this.props.parent.firstBin &&
                this.props.item.key.slice(0, 1) === "a") ||
                (link.upstream + 1 === this.props.parent.firstBin &&
                  this.props.item.key.slice(0, 1) === "d"))
            ) {
              return null;
            }
          }
        }

        //Third component side
        if (dComp && dComp.lastBin + 1 === this.props.parent.firstBin) {
          // If the other side is in view.

          let otherSideLinks;
          if (this.props.item.key.slice(0, 1) === "d") {
            otherSideLinks = dComp.rdepartures;
          } else {
            otherSideLinks = dComp.rarrivals;
          }

          for (let link of values(otherSideLinks)) {
            if (
              arraysEqual(link.participants, this.props.item.participants) &&
              link.otherSideRight &&
              ((link.upstream + 1 === dComp.firstBin &&
                this.props.item.key.slice(0, 1) === "a") ||
                (link.downstream + 1 === dComp.firstBin &&
                  this.props.item.key.slice(0, 1) === "d"))
            ) {
              return this.props.item.participants.map((item) => (
                <ConnectorRect
                  key={"connector" + this.props.item.index + item}
                  x={
                    this.props.parent.relativePixelX -
                    this.props.store.pixelsPerColumn +
                    1
                  }
                  y={this.props.y + item * this.props.store.pixelsPerRow}
                  width={this.props.store.pixelsPerColumn - 2} //Clarified and corrected adjacent connectors as based on pixelsPerColumn width #9
                  height={this.props.store.pixelsPerRow}
                  isToRight={this.props.item.key.slice(0, 1) === "a"}
                />
              ));

              // Add connector here
              // return null;
            }
          }
        }

        // Check if the link is in view and if the previously linked component has departure from right to right, then do not draw this arrow.
      }

      //link from second component to third component. (arrival)

      return true;
    }

    render() {
      //const contents = this.linkCells();
      // debugger;

      if (this.props.store.updatingVisible) {
        return null;
      }

      if (this.props.store.hideInversionLinks) {
        // if (this.props.item.upstream==121 && this.props.item.downstream==122 ||
        //   this.props.item.upstream==123 && this.props.item.downstream==124) {
        //   debugger;
        // }
        let res = this.checkSingleReverse();

        if (res !== true) {
          return res;
        }
      }

      const [localColor, localOpacity, localStroke] = stringToColorAndOpacity(
        this.props.item,
        this.props.store.highlightedLink
      );
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
