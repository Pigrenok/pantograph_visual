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

      let item =
        this.props.range[Math.min(this.props.range.length - 1, relColumnX)];
      // let pathName = this.props.pathName.startsWith("NC_045512")
      //   ? "Reference: " + this.props.pathName
      //   : this.props.pathName;
      let tooltipContent = '"';
      tooltipContent +=
        this.props.pathName +
        '"\nCoverage: ' +
        item.repeats +
        "\nInversion: " +
        item.reversal +
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

      if (this.props.store.metaData.get(this.props.pathName) !== undefined) {
        tooltipContent +=
          "\n" + this.props.store.metaData.get(this.props.pathName).Info;
      }
      this.props.store.updateCellTooltipContent(tooltipContent); //item[2] is array of ranges
      this.props.store.updateMouse(event.evt.clientX, event.evt.clientY);
    }

    onLeave() {
      this.props.store.updateCellTooltipContent(""); // we don't want any tooltip displayed if we leave the cell
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
      return (
        <Rect
          x={
            this.props.x +
            this.props.width -
            this.props.store.pixelsPerColumn * (1 - 0.5 * isSplit) -
            1
          }
          y={this.props.y}
          width={this.props.store.pixelsPerColumn * (1 - 0.5 * isSplit) - 2}
          height={this.props.height || 1}
          fill={color}
          stroke={"red"}
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

      return (
        <Rect
          x={this.props.x + 1}
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
      if (this.props.store.updatingVisible) {
        return null;
      }

      if (this.props.range === undefined || this.props.range.length === 0) {
        return null; //giving up
      }

      const rangeLength = this.props.range.length;

      const inverted =
        this.props.range.reduce((total, element) => {
          return total + element.reversal;
        }, 0) /
          rangeLength >
        0.5;
      const copyNumber = Math.round(
        this.props.range.reduce((total, element) => {
          return total + element.repeats;
        }, 0) / rangeLength
      );
      // const startBlock = this.props.range.findIndex((element) =>
      //   this.isStartInRange(element.pos)
      // );

      let color = this.props.color;

      // let boundaryThickness = 0;

      if (copyNumber > 1 && !inverted) {
        // 11 items is number of colors in copyNumberColorArray
        if (copyNumber < 10) {
          color = this.props.store.copyNumberColorArray[copyNumber];
        } else {
          color = this.props.store.copyNumberColorArray[10];
        }
      }

      if (inverted) {
        // 11 items is number of colors in invertedColorArray
        if (copyNumber < 10) {
          color = this.props.store.invertedColorArray[copyNumber];
        } else {
          color = this.props.store.invertedColorArray[10];
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

    render() {
      if (this.props.store.updatingVisible) {
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
      let startCompBin = 0;
      if (this.props.store.getBeginBin > this.props.parent.firstBin) {
        startCompBin =
          this.props.store.getBeginBin - this.props.parent.firstBin;
        startPos = this.props.entry.occupiedBins.findIndex((value) => {
          return value >= startCompBin;
        });
        x = this.props.entry.occupiedBins[startPos] - startCompBin;
        if (startPos === -1) {
          startPos = this.props.entry.occupiedBins.length;
          x = 0;
        }
      } else {
        x = this.props.entry.occupiedBins[startPos];
      }

      let prev =
        startPos < this.props.entry.occupiedBins.length
          ? this.props.entry.occupiedBins[startPos] - 1
          : 0;
      // console.debug("[SpanCell.render] this.props.entry.binData[0]",
      //   this.props.entry.binData[0].pos[0][0],this.props.entry.binData[0].pos[0][1])
      // console.debug("[SpanCell.render] this.props.entry.binData[0].pos[0].includes(1)",
      //   this.props.entry.binData[0].pos[0].includes(1))

      let isStart = this.props.entry.binData[0].pos[0].includes(1);
      // let isStart = false;

      // console.debug("[SpanCell.render] isStart", isStart);

      let isEnd = false;
      if (this.props.parent.ends) {
        isEnd = this.props.parent.ends.includes(this.props.rowNumber);
      }

      let isSplit = isStart && isEnd && this.props.parent.numBins == 1;

      // console.debug("[SpanCell.render] this.props.parent",this.props.parent)
      // console.debug("[SpanCell.render] this.props.rowNumber",this.props.rowNumber)
      // console.debug("[SpanCell.render] isEnd",isEnd)

      let matrixCells = [];
      let newSpan = [];

      for (let i = startPos; i < this.props.entry.occupiedBins.length; i++) {
        let column = this.props.entry.occupiedBins[i];
        if (column === prev + 1) {
          //contiguous
          newSpan.push(this.props.entry.binData[i]);
        } else {
          //non-contiguous
          matrixCells.push(
            <MatrixCell
              key={"span" + this.props.entry.pathID + "," + x}
              range={newSpan}
              store={this.props.store}
              pathName={this.props.pathName}
              color={this.props.color}
              x={this.props.x + x * this.props.store.pixelsPerColumn}
              y={this.props.y}
              isStart={isStart}
              isSplit={isSplit}
              rowNumber={this.props.entry.pathID}
              width={newSpan.length * this.props.store.pixelsPerColumn}
              height={this.props.store.pixelsPerRow}
              handleClickMethod={this.props.handleClickMethod}
            />
          );
          isStart = false;
          x = column - startCompBin;
          //create new newSpan
          newSpan = [this.props.entry.binData[i]];
        }
        prev = column;
      }
      matrixCells.push(
        <MatrixCell
          key={"span" + this.props.entry.pathID + "," + x}
          range={newSpan}
          store={this.props.store}
          pathName={this.props.pathName}
          color={this.props.color}
          x={this.props.x + x * this.props.store.pixelsPerColumn}
          y={this.props.y}
          isStart={isStart}
          isEnd={isEnd}
          isSplit={isSplit}
          rowNumber={this.props.entry.pathID}
          width={newSpan.length * this.props.store.pixelsPerColumn}
          height={this.props.store.pixelsPerRow}
          handleClickMethod={this.props.handleClickMethod}
        />
      );
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
