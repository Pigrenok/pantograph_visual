import React from "react";
import { Rect, Text } from "react-konva";
import { observer } from "mobx-react";

import { jsonCache } from "./ViewportInputsStore";

export const MatrixCell = observer(
  class extends React.Component {
    // This component draws a continuous uninterrupted row of cells with identical properties (e.g. inversion, copy number, etc).
    cellDataCalc(event) {
      // Calculating data for clicked (or moused over) cell for tool tip and for floating window

      let relColumnX = Math.floor(
        Math.max(0, event.evt.layerX - this.props.x) /
          this.props.store.pixelsPerColumn
      );

      let itemIndex = Math.min(this.props.range.length - 1, relColumnX);
      let item = this.props.range[itemIndex];
      let bin = this.props.binRange[itemIndex];

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
          new_content = ", " + new_content;
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

      return resultArray;
    }

    basicDataString(
      accession,
      isStart,
      isEnd,
      repeats,
      reversal,
      bin,
      posRanges,
      floatWin = false
    ) {
      // Generating HTML string for tooltip and for floating window.

      let imgInfo = (text) => {
        return `<img src='${process.env.PUBLIC_URL}/info.png' height=15 title="${text}"/>`;
      };

      let dataString = "";

      dataString += (floatWin ? "Accession: " : "") + accession;
      if (isStart) {
        dataString += " [Start]";
      }

      if (isEnd) {
        dataString += " [End]";
      }

      dataString +=
        (floatWin
          ? "<br>" +
            imgInfo(
              "Average copy number over all nucleotides/genes in the cell. For the maximum zoom level copy number of a gene/nucleotide."
            )
          : "\n") +
        " Average Copy Number: " +
        repeats +
        (floatWin
          ? "<br>" +
            imgInfo(
              "Average fraction of all nucleotides/genes (including all copies) within in the cell that are inverted. For the maximum zoom level fraction of copies of the given nucleotide/gene that are inverted."
            )
          : "\n") +
        " Average Inversion Fraction: " +
        reversal +
        (floatWin
          ? "<br>" +
            imgInfo(
              "Column number in the given pangenome at the given zoom level. Debug only."
            )
          : "\n") +
        " Column number: " +
        bin +
        (floatWin
          ? "<br>" +
            imgInfo(
              "The same as genomic position for nucleotide graphs and number of gene in sequence of genes for gene graph. Debug only"
            )
          : "\n") +
        " Path position: " +
        posRanges;

      return dataString;
    }

    onHover(event) {
      // Getting tooltip text filled up and shown when a mouse is over specific cell.
      // This function also highlights specific accession if this option is selected.

      let [isStart, isEnd, repeats, reversal, bin, posRanges] =
        this.cellDataCalc(event);

      let tooltipContent = this.basicDataString(
        this.props.pathName,
        isStart,
        isEnd,
        repeats,
        reversal,
        bin,
        posRanges,
        false
      );

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
      // Clearing tooltip and highlighted accession/row when mouse leave it.

      this.props.store.updateCellTooltipContent(""); // we don't want any tooltip displayed if we leave the cell
      this.props.store.clearHighlightedAccession(); // Colour back all accessions.

      let box = document.getElementById("floating");
      if (box.style.display == "none") {
        document.getElementById("floating").innerHTML = "";
      }
    }

    getFloatWindowContext(event) {
      // Preparing floating window HTML string.

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

      windowContent += this.basicDataString(
        this.props.pathName,
        isStart,
        isEnd,
        repeats,
        reversal,
        bin,
        posRanges,
        true
      );

      windowContent += "</p>";

      return [windowContent, bin];
    }

    getLinkToJBrowse(acc, genposblock) {
      // This function generates `a` tag with link to 1001G+ JBrowse instance. One need to change the link if you want to use different JBrowse
      // (or any other genomic browser).
      // This function gets `acc`, which is a string containing accession ID and `genposblock`, which is a string defining the position
      // At the moment it is in the following format: `<chromosome>:<start position>..<end position>`
      // The format of the position is defined in the API, not in this app. This function just substitute any string passed without validation.
      // If it needs to be separated (chromosome separate from start and end position), then this and `loadExtraFromAPI` functions need to be changed.
      return `<a 
            href='https://tools.1001genomes.org/jbrowse/1001G+/accessions/current/index.html?data=${acc}&loc=${acc}_${genposblock}&tracks=DNA%2C${acc}&highlight='
            target='_blank'>${genposblock}</a><br>`;
    }

    loadExtraFromAPI(bin, box) {
      // Obtaining extra information from external API for floating window and preparing HTML block to show this info.

      function recordData(box, acc, res) {
        let [ann, genpos, altgenpos, pangenpos] = res.split(";");

        let genPosString = "";

        if (genpos !== "") {
          let genPosArray = genpos.split(",");

          genPosString += "<p><br>Genomic positions:<br>";

          for (let genposblock of genPosArray) {
            // Accession this.props.pathName
            genPosString += getLinkToJBrowse(acc, genposblock);
          }

          genPosString += "</p>";
        }

        let pangenPosString = "";

        if (pangenpos !== "") {
          let pangenPosArray = pangenpos.split(",");

          pangenPosString += "<p><br>Pangenomic positions:<br>";

          for (let pangenposblock of pangenPosArray) {
            // Accession this.props.pathName
            pangenPosString += getLinkToJBrowse(acc, pangenposblock);
          }

          pangenPosString += "</p>";
        }

        let altGenPosString = "";

        if (altgenpos !== "") {
          let altGenPosArray = altgenpos.split(",");

          altGenPosString += "<p><br>Positions on other chromosomes:<br>";

          for (let altGenPosBlock of altGenPosArray) {
            altGenPosString += getLinkToJBrowse(acc, altGenPosBlock);
          }

          altGenPosString += "</p>";
        }

        box.innerHTML += genPosString;
        box.innerHTML += pangenPosString;
        box.innerHTML += altGenPosString;

        let annotationsArray = ann.split(",");

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
      const jsonName = this.props.store.selectedProjectCase;
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
        .then((res) => recordData(box, this.props.pathName, res));
    }

    onClick(e) {
      if (e.evt.button == 0) {
        // Left mouse click
        // Select a component
        this.props.handleClickMethod();
      } else if (e.evt.button == 2) {
        // Right mouse click
        // Open floating window.

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

    inversionText(inverted) {
      // Shows "less" symbol as aninversion symbol in the cells (do not mix up with continuity arrow between two inversion components, which is the same symbol).
      if (this.props.store.pixelsPerRow > 9 && inverted) {
        return (
          <Text
            x={this.props.x}
            y={this.props.y}
            width={this.props.width}
            height={this.props.height || 1}
            fontSize={Math.min(this.props.width, this.props.height)}
            align={"center"}
            verticalAlign={"middle"}
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
      // Draw red rectangle around cell marking the end of the path/sequence.
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
      // Draw green rectangle around cell marking the start of the path/sequence.
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
        return null;
      }

      const rangeLength = this.props.range.length;

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

      let color = this.props.store.copyNumberColorArray[0];
      if (inverted) {
        color = this.props.store.invertedColorArray[0];
      }

      if (this.props.store.colourRepeats && copyNumber > 1) {
        if (!inverted) {
          if (copyNumber < 10) {
            color = this.props.store.copyNumberColorArray[copyNumber - 1];
          } else {
            color = this.props.store.copyNumberColorArray[9];
          }
        } else {
          if (copyNumber < 10) {
            color = this.props.store.invertedColorArray[copyNumber - 1];
          } else {
            color = this.props.store.invertedColorArray[9];
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

export const SpanCell = observer(
  class extends React.Component {
    // This class renders whole row of cells for a single component.
    constructor(props) {
      super(props);
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
      return [adjustment, startPos, x];
    }

    adjustEnd(adjustment, defaultValue) {
      let endPos = this.props.entry.occupiedBins.findIndex((value) => {
        return value > adjustment;
      });

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
      }

      if (startPos == endPos) {
        return null;
      }

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
