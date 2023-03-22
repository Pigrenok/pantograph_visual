import React from "react";
import { Rect, Arrow } from "react-konva";
import { observer } from "mobx-react";
import { stringToColorAndOpacity, arraysEqual, linkKey } from "./utilities";
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
      // Show some link info in tooltip.
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
      // Jumping by clicking on the link. It will jump to the other end of the arrow.
      // Do not forget that if both start and end are in the view, most of the arrow belongs to the departure column
      // and after click on the arrow itself, it jumps to arrival column (or nearest main matrix column).
      let centreBin;
      let highlightedLink = null;

      if (this.props.item.key[0] === "d") {
        // departure
        centreBin = this.props.item.downstream;
      }

      if (this.props.item.key[0] === "a") {
        //arrival
        centreBin = this.props.item.upstream;
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
      // This is the central function for drawing arrows.
      // By adding extra points it can either draw a full arrow from start to end (if both are visible),
      // which is done only for departure column (for arrival only stub with arrowhead is drawn)
      // If start (for arrival) or end (for departure) is not in the view, this function does provides
      // only coordinates for a stub
      let parentZoomLevel = this.props.parent.zoom_level;
      if (this.props.item.key[0] === "d") {
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

    renderArrow(points, color, opacity, hideLink) {
      // This function simply draws an arrow itself.
      let arrowOpacity = opacity;
      if (this.props.store.doHighlightRows) {
        if (this.props.store.highlightedAccession != null) {
          if (
            !this.props.item.participants.includes(
              this.props.store.highlightedAccession
            )
          ) {
            arrowOpacity = this.props.store.hiddenElementOpacity;
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
          onMouseOver={
            hideLink
              ? null
              : () => {
                  this.handleMouseOver();
                }
          }
          onMouseOut={hideLink ? null : this.handleMouseOut}
          onClick={hideLink ? null : this.handleClick}
          // lineCap={'round'}
        />
      );
    }

    checkSingleReverse() {
      // This functionality will hide a pair of arrows describing simple inversion and make a simple pair of continuity arrows instead.

      let compLinks;
      let linkKeyToSearch;

      let isRight;

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
        this.props.store.highlightedLink,
        this.props.store.hiddenElementOpacity
      );

      let hideLink = false;
      if (this.props.store.filterPaths.length > 0) {
        if (this.props.store.filterMainAccession === null) {
          // If main accession is not selected
          let interactionsN = this.props.store.filterPaths.filter((el) =>
            this.props.item.participants.includes(el)
          ).length;
          let filterLength = this.props.store.filterPaths.length;
          // Checking if this link is a diff between selected accessions
          if (interactionsN === 0 || interactionsN === filterLength) {
            // If not, hide the link.
            hideLink = true;
          }
        } else {
          // If main accession is selected
          let otherAcc = this.props.store.filterPaths.filter(
            (el) => el !== this.props.store.filterMainAccession
          );
          let otherInvolved = otherAcc.some((el) =>
            this.props.item.participants.includes(el)
          );
          let mainInvolved = this.props.item.participants.includes(
            this.props.store.filterMainAccession
          );

          if (mainInvolved === otherInvolved) {
            hideLink = true;
          }
        }
      }

      // This does not work if filter is used
      // because preferHighlight is disabled when filter is activated.
      if (this.props.store.preferHighlight) {
        if (this.props.store.highlightedAccession == null) {
          hideLink = true;
          // localOpacity = this.props.store.hiddenElementOpacity;
        }
      }

      let points = this.points();

      return (
        <>
          {points.length > 0
            ? this.renderArrow(
                points,
                localColor,
                hideLink ? this.props.store.hiddenElementOpacity : localOpacity,
                hideLink
              )
            : null}
          {this.props.item.participants.map((pathID) => {
            let rowOpacity = localOpacity;

            if (!hideLink) {
              if (
                this.props.store.doHighlightRows &&
                this.props.store.highlightedAccession != null
              ) {
                // Highlighting works and an accession should be highlighted
                if (
                  (this.props.store.filterPaths.includes(pathID) ||
                    this.props.store.filterPaths.length === 0) &&
                  this.props.store.highlightedAccession === pathID
                ) {
                  rowOpacity = 1;
                } else {
                  rowOpacity = this.props.store.hiddenElementOpacity;
                }
              } else {
                // Either highlighting is deactivated or mouse is not over an accession
                if (
                  this.props.store.filterPaths.includes(pathID) ||
                  this.props.store.filterPaths.length === 0
                ) {
                  rowOpacity = 1;
                } else {
                  rowOpacity = this.props.store.hiddenElementOpacity;
                }
              }
            } else if (this.props.store.preferHighlight) {
              if (
                this.props.store.doHighlightRows &&
                this.props.store.highlightedAccession !== null
              ) {
                if (this.props.store.highlightedAccession !== pathID) {
                  rowOpacity = this.props.store.hiddenElementOpacity;
                } else {
                  rowOpacity = 1.0;
                }
              }
            } else {
              rowOpacity = this.props.store.hiddenElementOpacity;
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
                onMouseOver={
                  rowOpacity == 1 ? () => this.handleMouseOver(pathID) : null
                }
                onMouseOut={rowOpacity == 1 ? this.handleMouseOut : null}
                onClick={rowOpacity == 1 ? this.handleClick : null}
              />
            );
          })}
        </>
      );
    }
  }
);

export default LinkColumn;
