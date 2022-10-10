import React from "react";
import { Rect, Text } from "react-konva";
import { observer } from "mobx-react";
import PropTypes from "prop-types";

export const MatrixCell = observer(
  class extends React.Component {
    onHover(event) {
      //tooltip: this.props.item.mean_pos

      // An example: Path_name, Coverage: 0.23, Inversion: 0.0, Pos: 2365-27289

      //TODO: calculate relative X and select item from this.props.range
      let relColumnX = Math.floor(
        Math.max(0, event.evt.layerX - this.props.x) /
          this.props.store.pixelsPerColumn
      );
      // console.log(event, this.props.range, relColumnX);

      let itemIndex = Math.min(this.props.range.length - 1, relColumnX);
      let item = this.props.range[itemIndex];
      let bin = this.props.binRange[itemIndex];

      // let pathName = this.props.pathName.startsWith("NC_045512")
      //   ? "Reference: " + this.props.pathName
      //   : this.props.pathName;
      let tooltipContent = '"';
      tooltipContent += this.props.pathName + '"';

      this.props.store.setHighlightedAccession(this.props.rowNumber);

      if (this.props.isStart) {
        if (
          (!this.props.inverted && relColumnX === 0) ||
          (this.props.inverted && relColumnX === this.props.range.length - 1)
        ) {
          tooltipContent += " [Start]";
        }
      }

      if (this.props.isEnd) {
        if (
          (this.props.inverted && relColumnX === 0) ||
          (!this.props.inverted && relColumnX === this.props.range.length - 1)
        ) {
          tooltipContent += " [End]";
        }
      }
      tooltipContent +=
        "\nCoverage: " +
        item.repeats +
        "\nInversion: " +
        item.reversal +
        "\nBin: " +
        bin +
        "\nPos: ";

      const ranges = item.pos;
      for (let j = 0; j < ranges.length; j++) {
        const start = ranges[j][0];
        const end = ranges[j][1];
        let new_content = "";

        if (start === 0 || start === end) {
          new_content = end;
        } else if (end === 0) {
          new_content = start; // + "-";
        } else {
          new_content = start + "-" + end;
        }

        if (j > 0) {
          new_content = "," + new_content;
        }

        tooltipContent += new_content;
      }

      let maxNumAnnotationToShow = 15;

      if (item.annotation.length > 0) {
        // if (item.reversal <= 0.5) {
        tooltipContent +=
          "\n" +
          item.annotation
            .slice()
            .sort((a, b) => {
              return a.length - b.length;
            })
            .slice(0, maxNumAnnotationToShow)
            .join("\n");

        if (item.annotation.length > maxNumAnnotationToShow) {
          tooltipContent += "\n... (" + item.annotation.length + ")";
        }
        // } else {
        // tooltipContent += "\n" + item.annotation.reverse();
        // }
      }

      if (this.props.store.metaData.get(this.props.pathName) !== undefined) {
        tooltipContent +=
          "\n" + this.props.store.metaData.get(this.props.pathName).Info;
      }
      this.props.store.updateCellTooltipContent(tooltipContent); //item[2] is array of ranges
      this.props.store.updateMouse(event.evt.clientX, event.evt.clientY);
    }

    onLeave() {
      this.props.store.updateCellTooltipContent(""); // we don't want any tooltip displayed if we leave the cell
      this.props.store.clearHighlightedAccession(); // Colour back all accessions.
    }

    isStartInRange(array) {
      return (
        array.filter((value) => value[0] === 1 || value[1] === 1).length > 0
      );
    }

    /**Reduced number of Text elements generated for inversions,
     * mouse events restored**/
    inversionText(inverted) {
      if (this.props.store.pixelsPerRow > 9 && inverted) {
        return (
          <Text
            x={this.props.x}
            y={this.props.y}
            width={this.props.width}
            height={this.props.height || 1}
            align={"center"}
            verticalAlign={"center"}
            text={inverted ? "<" : " "}
            onMouseMove={this.onHover.bind(this)}
            onMouseLeave={this.onLeave.bind(this)}
            onClick={this.props.handleClickMethod}
          />
        );
      } else {
        return null;
      }
    }

    renderEnd(color, isSplit) {
      // console.debug("[MatrixCell.renderEnd] isStart ",isStart)
      let this_x = this.props.x;
      if (this.props.inverted) {
        this_x += 1;
      } else {
        this_x +=
          this.props.width -
          this.props.store.pixelsPerColumn * (1 - 0.5 * isSplit) +
          1;
      }

      let stroke = "red";
      if (this.props.inverted) {
        stroke = "yellow";
      }

      return (
        <Rect
          x={this_x}
          y={this.props.y}
          width={this.props.store.pixelsPerColumn * (1 - 0.5 * isSplit) - 2}
          height={this.props.height || 1}
          fill={color}
          stroke={stroke}
          strokeWidth={2}
          onMouseMove={this.onHover.bind(this)}
          onMouseLeave={this.onLeave.bind(this)}
          onClick={this.props.handleClickMethod}
        />
      );
    }

    renderStart(color, isSplit) {
      // console.debug("[MatrixCell.renderStart] startPos ",startPos)
      // console.debug("[MatrixCell.renderStart] isEnd ",isEnd)
      let this_x = this.props.x;
      if (this.props.inverted) {
        this_x +=
          this.props.width -
          this.props.store.pixelsPerColumn * (1 - 0.5 * isSplit) +
          1;
      } else {
        this_x += 1;
      }

      return (
        <Rect
          x={this_x}
          y={this.props.y}
          width={(this.props.store.pixelsPerColumn - 2) * (1 - 0.5 * isSplit)}
          height={this.props.height || 1}
          fill={color}
          stroke={"limegreen"}
          strokeWidth={2}
          onMouseMove={this.onHover.bind(this)}
          onMouseLeave={this.onLeave.bind(this)}
          onClick={this.props.handleClickMethod}
        />
      );
    }
    render() {
      if (this.props.store.chunkLoading) {
        return null;
      }

      if (this.props.range === undefined || this.props.range.length === 0) {
        return null; //giving up
      }

      const rangeLength = this.props.range.length;

      // console.log('[MatrixCell.render] this.props.pathName', this.props.pathName)
      // console.log('[MatrixCell.render] this.props.range', this.props.range)

      const inverted =
        this.props.range.reduce((total, element) => {
          return total + element.reversal;
        }, 0) /
          rangeLength >
        0.5;
      let floatCopyNumber =
        this.props.range.reduce((total, element) => {
          return total + element.repeats;
        }, 0) / rangeLength;
      const copyNumber = Math.ceil(floatCopyNumber - 0.5);

      // const startBlock = this.props.range.findIndex((element) =>
      //   this.isStartInRange(element.pos)
      // );
      let color = this.props.store.copyNumberColorArray[0];
      if (inverted) {
        color = this.props.store.invertedColorArray[0];
      }
      // let color = this.props.color;

      // let boundaryThickness = 0;

      if (this.props.store.colourRepeats && copyNumber > 1) {
        if (!inverted) {
          // 11 items is number of colors in copyNumberColorArray
          if (copyNumber < 10) {
            color = this.props.store.copyNumberColorArray[copyNumber];
          } else {
            color = this.props.store.copyNumberColorArray[10];
          }
        } else {
          // 11 items is number of colors in invertedColorArray
          if (copyNumber < 10) {
            color = this.props.store.invertedColorArray[copyNumber];
          } else {
            color = this.props.store.invertedColorArray[10];
          }
        }
      }
      if (this.props.store.preferHighlight) {
        if (this.props.store.highlightedAccession == null) {
          color = color + "4C";
        }
      }

      if (this.props.store.doHighlightRows) {
        if (this.props.store.highlightedAccession != null) {
          if (this.props.store.highlightedAccession != this.props.rowNumber) {
            color = color + "4C";
          }
        }
      }
      // console.debug("[MatrixCell.render] x, y, width, height",
      //               this.props.x,
      //               this.props.y,
      //               this.props.width,
      //               this.props.height)
      // TODO: if possible, use HTML/CSS to write the '<', avoiding the <Text />s rendering, therefore improving the performance
      // console.debug("[MatrixCell.render] startPos ",startBlock)
      // console.debug("[MatrixCell.render] isStart ",this.props.isStart)
      // console.debug("[MatrixCell.render] isEnd ",this.props.isEnd)
      // console.debug("[MatrixCell.render] isSplit ",this.props.isSplit)

      return (
        <>
          <Rect
            x={this.props.x}
            y={this.props.y}
            width={this.props.width}
            height={this.props.height || 1}
            fill={color}
            onMouseMove={this.onHover.bind(this)}
            onMouseLeave={this.onLeave.bind(this)}
            onClick={this.props.handleClickMethod}
          />
          {this.inversionText(inverted)}
          {this.props.isStart
            ? this.renderStart(color, this.props.isSplit)
            : null}
          {this.props.isEnd ? this.renderEnd(color, this.props.isSplit) : null}
        </>
      );
    }
  }
);

MatrixCell.propTypes = {
  store: PropTypes.object,
  range: PropTypes.object,
  x: PropTypes.number,
  y: PropTypes.number,
  width: PropTypes.number,
  height: PropTypes.number,
  color: PropTypes.node,
  pathName: PropTypes.node,
};

export const SpanCell = observer(
  class extends React.Component {
    constructor(props) {
      super(props);
      // this.width = this.props.parent.numBins;
      //https://github.com/graph-genome/Schematize/issues/87
      //Sparse matrix includes the relative columns for each bin inside a component
      //Columns are not necessarily contiguous, but follow the same order as `row`
    }

    adjustStart(adjustment, defaultValue) {
      let startPos = this.props.entry.occupiedBins.findIndex((value) => {
        return value >= adjustment;
      });
      let x = this.props.entry.occupiedBins[startPos] - adjustment;
      if (startPos === -1) {
        startPos = defaultValue;
        x = 0;
      }
      return [adjustment, startPos, x]; //startCompBin,startPos,x
    }

    adjustEnd(adjustment, defaultValue) {
      // console.debug("[SpanCell.adjustEnd] adjustment", adjustment);
      let endPos = this.props.entry.occupiedBins.findIndex((value) => {
        return value > adjustment;
      });
      // console.debug("[SpanCell.adjustEnd] endPos", endPos);

      let x = this.props.entry.occupiedBins[endPos - 1] - adjustment;
      if (endPos === -1) {
        endPos = defaultValue;
        x = 0;
      }

      return [adjustment, endPos, x];
    }

    render() {
      if (this.props.store.chunkLoading) {
        return null;
      }

      if (!this.props.entry || !this.props.entry.occupiedBins.length) {
        return null;
      }
      // if (this.props.store.getBeginBin === 41196 && this.props.entry.pathID===26) {
      //   debugger;
      // }
      let startPos = 0;
      let x = 0;
      let xAdjustment = 0;
      let endVisible = true;
      let endPos = this.props.entry.occupiedBins.length;

      let startVisible = true;
      if (this.props.store.getBeginBin > this.props.parent.firstBin) {
        startVisible = false;
        if (this.props.entry.inverted) {
          [xAdjustment, endPos, x] = this.adjustEnd(
            this.props.parent.numBins -
              (this.props.store.getBeginBin - this.props.parent.firstBin) -
              1,
            this.props.entry.occupiedBins.length
          );
        } else {
          [xAdjustment, startPos, x] = this.adjustStart(
            this.props.store.getBeginBin - this.props.parent.firstBin,
            this.props.entry.occupiedBins.length
          );
        }
      } else {
        if (this.props.entry.inverted) {
          x =
            this.props.parent.numBins -
            1 -
            this.props.entry.occupiedBins[endPos - 1];
        } else {
          x = this.props.entry.occupiedBins[startPos];
        }
      }

      if (this.props.store.getEndBin < this.props.parent.lastBin) {
        endVisible = false;
        if (this.props.entry.inverted) {
          [xAdjustment, startPos] = this.adjustStart(
            this.props.parent.lastBin - this.props.store.getEndBin,
            0
          );
        } else {
          [, endPos] = this.adjustEnd(
            this.props.parent.numBins -
              (this.props.parent.lastBin - this.props.store.getEndBin) -
              1,
            this.props.entry.occupiedBins.length
          );
        }

        // endPos -= this.props.parent.lastBin - this.props.store.getEndBin;
      }

      if (startPos == endPos) {
        return null;
      }

      // console.debug("[SpanCell.render] this.props.entry.binData[0]",
      //   this.props.entry.binData[0].pos[0][0],this.props.entry.binData[0].pos[0][1])
      // console.debug("[SpanCell.render] this.props.entry.binData[0].pos[0].includes(1)",
      //   this.props.entry.binData[0].pos[0].includes(1))

      let startBeginningMarker = false;
      let startEndMarker = false;
      let endBeginningMarker = false;
      let endEndMarker = false;

      let isStart = this.props.entry.binData[0].pos[0].includes(1);

      let isEnd = false;
      if (this.props.parent.ends.length > 0) {
        isEnd = this.props.parent.ends.includes(this.props.rowNumber);
      }

      if (this.props.entry.inverted) {
        startEndMarker = isStart && endVisible;
        endBeginningMarker = isEnd && startVisible;
      } else {
        startBeginningMarker = isStart && startVisible;
        endEndMarker = isEnd && endVisible;
      }

      let isSplit = isStart && isEnd && this.props.parent.numBins == 1;

      // console.debug("[SpanCell.render] this.props.parent",this.props.parent)
      // console.debug("[SpanCell.render] this.props.rowNumber",this.props.rowNumber)
      // console.debug("[SpanCell.render] isEnd",isEnd)

      // console.debug("[SpanCell.render] Component index",this.props.parent.index)
      // console.debug("[SpanCell.render] pathID",this.props.entry.pathID)

      // console.debug("[SpanCell.render] startBeginningMarker",startBeginningMarker)
      // console.debug("[SpanCell.render] startEndMarker",startEndMarker)
      // console.debug("[SpanCell.render] endBeginningMarker",endBeginningMarker)
      // console.debug("[SpanCell.render] endEndMarker",endEndMarker)

      let matrixCells = [];
      let newSpan = [];
      let binArray = [];

      let step;
      let starti;
      let endi;
      let prev;

      if (this.props.entry.inverted) {
        step = -1;
        starti = -1 * (endPos - 1);
        endi = -1 * (startPos - 1);

        // Check this!
        prev =
          startPos < endPos ? this.props.entry.occupiedBins[endPos - 1] + 1 : 0;
      } else {
        step = 1;
        starti = startPos;
        endi = endPos;
        prev =
          startPos < endPos ? this.props.entry.occupiedBins[startPos] - 1 : 0;
      }

      if (this.props.entry.binData[starti * step] === undefined) {
        debugger;
      }

      let prevOcc = Math.round(this.props.entry.binData[starti * step].repeats);
      let prevInv =
        this.props.entry.binData[starti * step].reversal > 0.5 ? 1 : 0;

      // console.debug("[SpanCell.render] component", this.props.parent);
      // console.debug("[SpanCell.render] pathName", this.props.pathName);
      // console.debug("[SpanCell.render] xAdjustment", xAdjustment);
      // console.debug("[SpanCell.render] x", x);
      // console.debug("[SpanCell.render] props.x", this.props.x);
      // console.debug("[SpanCell.render] starti", starti);
      // console.debug("[SpanCell.render] endi", endi);

      for (let i = starti; i < endi; i++) {
        let column = this.props.entry.occupiedBins[step * i];
        let bin = this.props.entry.binData[step * i];
        let occ = Math.round(bin.repeats);
        let inv = bin.reversal > 0.5 ? 1 : 0;

        if (column === prev + step && prevOcc === occ && prevInv === inv) {
          //contiguous
          newSpan.push(this.props.entry.binData[step * i]);
          binArray.push(column + this.props.parent.firstBin);
        } else {
          // console.debug("[SpanCell.render] newSpan",newSpan)
          // if (newSpan.length==0) {
          //   debugger
          // }
          //non-contiguous
          matrixCells.push(
            <MatrixCell
              key={"span" + this.props.entry.pathID + "," + x}
              range={newSpan}
              binRange={binArray}
              store={this.props.store}
              pathName={this.props.pathName}
              //color={this.props.color}
              x={this.props.x + x * this.props.store.pixelsPerColumn}
              y={this.props.y}
              isStart={startBeginningMarker}
              isEnd={endBeginningMarker}
              isSplit={isSplit}
              inverted={this.props.entry.inverted}
              rowNumber={this.props.entry.pathID}
              width={newSpan.length * this.props.store.pixelsPerColumn}
              height={this.props.store.pixelsPerRow}
              handleClickMethod={this.props.handleClickMethod}
            />
          );
          startBeginningMarker = false;
          endBeginningMarker = false;
          x =
            (step < 0 ? this.props.parent.numBins - 1 : 0) +
            step * column -
            xAdjustment;
          //create new newSpan
          newSpan = [this.props.entry.binData[step * i]];
          binArray = [column];
        }
        prev = column;
        prevOcc = occ;
        prevInv = inv;
      }

      if (matrixCells.length === 0) {
        startEndMarker = startBeginningMarker || startEndMarker;
        endEndMarker = endBeginningMarker || endEndMarker;
      }
      if (newSpan.length > 0) {
        matrixCells.push(
          <MatrixCell
            key={"span" + this.props.entry.pathID + "," + x}
            range={newSpan}
            binRange={binArray}
            store={this.props.store}
            pathName={this.props.pathName}
            //color={this.props.color}
            x={this.props.x + x * this.props.store.pixelsPerColumn}
            y={this.props.y}
            isStart={startEndMarker}
            isEnd={endEndMarker}
            isSplit={isSplit}
            inverted={this.props.entry.inverted}
            rowNumber={this.props.entry.pathID}
            width={newSpan.length * this.props.store.pixelsPerColumn}
            height={this.props.store.pixelsPerRow}
            handleClickMethod={this.props.handleClickMethod}
          />
        );
      }

      return <>{matrixCells}</>;
    }
  }
);

MatrixCell.propTypes = {
  row: PropTypes.node,
  iColumns: PropTypes.node,
  parent: PropTypes.object,
  store: PropTypes.object,
  pathName: PropTypes.node,
  y: PropTypes.number,
  rowNumber: PropTypes.number,
  verticalRank: PropTypes.number,
};
