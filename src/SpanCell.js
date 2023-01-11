import React from "react";
import { Rect, Text } from "react-konva";
import { observer } from "mobx-react";
import PropTypes from "prop-types";

import { jsonCache } from "./ViewportInputsStore";

export const MatrixCell = observer(
  class extends React.Component {
    cellDataCalc(event) {
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

      let isStart = false;
      let isEnd = false;

      if (this.props.isStart) {
        if (
          (!this.props.inverted && relColumnX === 0) ||
          (this.props.inverted && relColumnX === this.props.range.length - 1)
        ) {
          isStart = true;
        }
      }

      if (this.props.isEnd) {
        if (
          (this.props.inverted && relColumnX === 0) ||
          (!this.props.inverted && relColumnX === this.props.range.length - 1)
        ) {
          isEnd = true;
        }
      }

      const ranges = item.pos;
      let posRanges = "";
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

        posRanges += new_content;
      }

      let resultArray = [
        isStart,
        isEnd,
        item.repeats,
        item.reversal,
        bin,
        posRanges,
      ];
      // if (!tooltip) {
      //   // Loading annotation from external sources will go here.
      //   debugger;
      //   let maxNumAnnotationToShow = 15;

      //   let annot = "";

      //   if (item.annotation.length > 0) {
      //     // if (item.reversal <= 0.5) {
      //     annot +=
      //       // "\nAnnotation for column (" +
      //       // item.annotation.length + "):\n" +

      //       item.annotation
      //         .slice()
      //         .sort((a, b) => {
      //           return a.length - b.length;
      //         })
      //         // .slice(0, maxNumAnnotationToShow)
      //         .join(", ");
      //   }

      //   resultArray.push(annot);
      //   resultArray.push(item.annotation.length);
      // }

      return resultArray;
    }

    onHover(event) {
      let [isStart, isEnd, repeats, reversal, bin, posRanges] =
        this.cellDataCalc(event);

      let tooltipContent = "";
      tooltipContent += this.props.pathName;

      if (isStart) {
        tooltipContent += " [Start]";
      }

      if (isEnd) {
        tooltipContent += " [End]";
      }

      tooltipContent +=
        "\nCoverage: " +
        repeats +
        "\nInversion: " +
        reversal +
        "\nBin: " +
        bin +
        "\nPos: ";

      tooltipContent += posRanges;
      // if (this.props.store.metaData.get(this.props.pathName) !== undefined) {
      //   tooltipContent +=
      //     "\n" + this.props.store.metaData.get(this.props.pathName).Info;
      // }

      this.props.store.updateCellTooltipContent(tooltipContent); //item[2] is array of ranges
      this.props.store.updateMouse(event.evt.clientX, event.evt.clientY);
      if (
        this.props.store.filterPaths.length === 0 ||
        this.props.store.filterPaths.includes(this.props.rowNumber)
      ) {
        this.props.store.setHighlightedAccession(this.props.rowNumber);
      }
    }

    onLeave() {
      this.props.store.updateCellTooltipContent(""); // we don't want any tooltip displayed if we leave the cell
      this.props.store.clearHighlightedAccession(); // Colour back all accessions.

      let box = document.getElementById("floating");
      if (box.style.display == "none") {
        document.getElementById("floating").innerHTML = "";
      }
    }

    getFloatWindowContext(event) {
      let windowContent = "<p>";
      let [
        isStart,
        isEnd,
        repeats,
        reversal,
        bin,
        posRanges,
        // annotations,
        // annotLen,
      ] = this.cellDataCalc(event);

      windowContent += "Accession:" + this.props.pathName;

      if (isStart) {
        windowContent += " [Start]";
      }

      if (isEnd) {
        windowContent += " [End]";
      }

      windowContent +=
        "<br>Coverage: " +
        repeats +
        "<br>Inversion: " +
        reversal +
        "<br>Bin: " +
        bin +
        "<br>Pos: ";

      windowContent += posRanges;

      // if (annotations != "") {
      //   windowContent += "<br>Annotation (" + annotLen + ")<br>";
      //   windowContent += annotations;
      // }

      windowContent += "</p>";

      return [windowContent, bin];
    }

    loadExtraFromAPI(bin, box) {
      function recordData(box, res) {
        let annotationsArray = res.split(",");

        let annotationStr = "";

        if (annotationsArray.length > 0) {
          // if (item.reversal <= 0.5) {
          annotationStr +=
            "<p><br>Annotation (" + annotationsArray.length + ")<br>\n";

          annotationStr += annotationsArray
            .slice()
            .sort((a, b) => {
              return a.length - b.length;
            })
            // .slice(0, maxNumAnnotationToShow)
            .join(", ");
          annotationStr += "</p>";

          box.innerHTML += annotationStr;
        }
      }

      const addr = this.props.store.pathIndexServerAddress;
      const jsonName = this.props.store.jsonName;
      const path_name = this.props.pathName;
      const localBin = bin - this.props.parent.firstBin;
      const colStart =
        this.props.parent.firstCol +
        this.props.parent.binsToCols.slice(0, localBin).reduce((sum, a) => {
          return sum + a;
        }, 0) -
        1;
      const colEnd = colStart + this.props.parent.binsToCols[localBin] - 1;

      let url = `${addr}/annotation/${jsonName}/${path_name}/${colStart}/${colEnd}`;

      jsonCache
        .getRaw(url)
        .then((data) => data.text())
        .then((res) => recordData(box, res));
    }

    onClick(e) {
      if (e.evt.button == 0) {
        this.props.handleClickMethod();
      } else if (e.evt.button == 2) {
        let box = document.getElementById("floating");

        let [windowContent, bin] = this.getFloatWindowContext(e);

        this.props.store.highlightCell(bin, this.props.rowNumber);

        if (box.style.display == "none") {
          box.innerHTML = windowContent;
          this.loadExtraFromAPI(bin, box);
        }

        box.style.display = "block";
      }
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
            onContextMenu={(e) => {
              e.evt.preventDefault();
            }}
            onClick={this.onClick.bind(this)}
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
          onContextMenu={(e) => {
            e.evt.preventDefault();
          }}
          onClick={this.onClick.bind(this)}
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
          onContextMenu={(e) => {
            e.evt.preventDefault();
          }}
          onClick={this.onClick.bind(this)}
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

      let dehighlighted = false;
      if (this.props.store.filterPaths.length > 0) {
        if (!this.props.store.filterPaths.includes(this.props.rowNumber)) {
          color = color + "4C";
          dehighlighted = true;
        }
      }

      if (this.props.store.preferHighlight && !dehighlighted) {
        if (this.props.store.highlightedAccession == null) {
          color = color + "4C";
          dehighlighted = true;
        }
      }

      if (this.props.store.doHighlightRows && !dehighlighted) {
        if (this.props.store.highlightedAccession != null) {
          if (this.props.store.highlightedAccession != this.props.rowNumber) {
            color = color + "4C";
            dehighlighted = true;
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
            onContextMenu={(e) => {
              e.evt.preventDefault();
            }}
            onClick={this.onClick.bind(this)}
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

      // if (this.props.parent.zoom_level=='32' &&
      //     this.props.pathName=='6069') {
      //   debugger;
      // }
      let binArrayStart;
      let binArrayDir;
      if (this.props.entry.inverted) {
        binArrayStart = this.props.parent.lastBin;
        binArrayDir = -1;
      } else {
        binArrayStart = this.props.parent.firstBin;
        binArrayDir = 1;
      }

      for (let i = starti; i < endi; i++) {
        let column = this.props.entry.occupiedBins[step * i];
        let bin = this.props.entry.binData[step * i];
        let occ = Math.round(bin.repeats);
        let inv = bin.reversal > 0.5 ? 1 : 0;

        if (column === prev + step && prevOcc === occ && prevInv === inv) {
          //contiguous
          newSpan.push(this.props.entry.binData[step * i]);
          binArray.push(binArrayStart + binArrayDir * column);
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
              parent={this.props.parent}
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
          binArray = [binArrayStart + binArrayDir * column];
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
            parent={this.props.parent}
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
