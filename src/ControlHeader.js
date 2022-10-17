import React from "react";
import { Observer, observer } from "mobx-react";
import { httpGetAsync } from "./URL";
import PropTypes from "prop-types";
import "./App.css";

import { jsonCache } from "./ViewportInputsStore";

const ControlHeader = observer(
  class extends React.Component {
    constructor(props) {
      super(props);

      this.posTimer = null;
      this.widthTimer = null;
    }

    shift(percentage) {
      const pos = this.props.store.getPosition;
      // const endBin = this.props.store.getEndBin;
      let diff;
      if (percentage > 0) {
        let size = this.props.store.getEndBin - pos;
        diff = Math.ceil(size * (percentage / 100));
      } else {
        let size = pos - this.props.store.getBeginBin;
        diff = Math.floor(size * (percentage / 100));
      }

      this.props.store.updatePosition(pos + diff);
    }

    handleJump() {
      // Need attention
      // console.log(
      //   "JUMP: path name: " +
      //     this.props.store.pathNucPos.path +
      //     " nucleotide position: " +
      //     this.props.store.pathNucPos.nucPos
      // );
      // I don't know why, but in order for the CORS headers to exchange we need to make a first GET request to "/hi" which will not return anything

      const store = this.props.store;
      const addr = store.pathIndexServerAddress;
      const path_name = store.searchTerms.path;
      const search = store.searchTerms.search;
      const doSearchGenes = store.searchTerms.searchGenes;
      const jsonName = store.jsonName;
      const zoomLevel = store.selectedZoomLevel;

      function handleSearchServerResponse(result) {
        if (result === "-1") {
          alert(`Did not find position ${search} in accession ${path_name}.`);
        } else if (result === "-2") {
          alert(`Did not find case ${jsonName} in database.`);
        } else {
          // console.log('[ControlHeader.handleJump.handleSearchServerResponse] Found bin',result);
          // go from nucleotide position to bin
          result = parseInt(result);

          result = Math.max(1, result);

          // let jumpToRight;
          // if (store.centreBin >= result) {
          //   jumpToRight = -1;
          // } else {
          //   jumpToRight = 1;
          // }

          store.updatePosition(result, true);
          // store.updateBeginEndBin(result, true);
        }
      }
      // httpGetAsync(addr + "hi", printResult);
      // httpGetAsync(addr + "5/1", printResult);
      // httpGetAsync(addr + "4/3", printResult);
      let url = `${addr}/${
        doSearchGenes ? "gene" : "pos"
      }/${jsonName}/${path_name}/${zoomLevel}/${search}`;
      // if (searchGenes) {
      //   let url = `${addr}/gene/${jsonName}/${path_name}/${zoomLevel}/${search}`;
      // } else {
      //   let url = `${addr}/pos/${jsonName}/${path_name}/${zoomLevel}/${search}`;
      // }

      //httpGetAsync(`${addr}/${path_name}/${nuc_pos}`, handleOdgiServerResponse);
      jsonCache
        .getRaw(url)
        .then((data) => data.text())
        .then(handleSearchServerResponse.bind(this));
    }

    change_zoom_level(target) {
      console.log(
        "change_zoom_level: " +
          target.value +
          " ---" +
          target.options[target.selectedIndex].text
      );

      this.props.store.setIndexSelectedZoomLevel(parseInt(target.value));
    }

    decIndexSelectedZoomLevel() {
      this.props.store.setUpdatingVisible();
      let indexSelZoomLevel = this.props.store.indexSelectedZoomLevel;
      if (indexSelZoomLevel > 0) {
        this.props.store.setIndexSelectedZoomLevel(indexSelZoomLevel - 1);
      } else {
        this.props.store.clearUpdatingVisible();
      }
    }

    incIndexSelectedZoomLevel() {
      this.props.store.setUpdatingVisible();
      let indexSelZoomLevel = this.props.store.indexSelectedZoomLevel;
      if (indexSelZoomLevel < this.props.store.availableZoomLevels.length - 1) {
        this.props.store.setIndexSelectedZoomLevel(indexSelZoomLevel + 1);
      } else {
        this.props.store.clearUpdatingVisible();
      }
    }

    // testJSON() {
    //   jsonCache
    //     .getJSON("/test_data/shorttest2.seg/bin2file.json")
    //     .then((response) => {
    //       console.log("This is what was returned from cache: ", response);
    //     });

    // }

    // testChunkIndex() {
    //   let jsonfilename = "AT_Chr1_OGOnly_strandReversal_new.seg"
    //   this.props.store.loadIndexFile(jsonfilename);
    // }

    handleShift(event) {
      this.props.store.setEditingPosition(Number(event.target.value));
      if (this.posTimer !== null) {
        clearTimeout(this.posTimer);
      }

      this.posTimer = setTimeout(() => {
        this.props.store.updatePosition(this.props.store.editingPosition);
        this.posTimer = null;
      }, 1000);
    }

    handleChangeWidth(event) {
      this.props.store.updateEditingWidth(Number(event.target.value));
      if (this.widthTimer !== null) {
        clearTimeout(this.widthTimer);
      }

      this.widthTimer = setTimeout(() => {
        this.props.store.updateWidth(this.props.store.editingPixelsPerColumn);
        this.widthTimer = null;
      }, 1000);
    }

    render() {
      return (
        <div id="button-container">
          {/*<button className="button" id="btn-download">*/}
          {/*  Save Image*/}
          {/*</button>*/}
          <input
            type="text"
            defaultValue={this.props.store.jsonName}
            style={{ width: "330px" }}
            onChange={(event) => {
              this.props.store.tryJSONpath(event.target.value);
            }}
            title={"File:"}
            disabled={this.props.store.updatingVisible}
          />
          <span style={{ marginLeft: "30px" }}>
            <>
              Bin width:
              <button
                className="button"
                onClick={() => this.decIndexSelectedZoomLevel()}
                disabled={this.props.store.updatingVisible}
              >
                -
              </button>
              <select
                id="select_bin_width"
                onChange={(event) => this.change_zoom_level(event.target)}
                value={this.props.store.indexSelectedZoomLevel}
                disabled={this.props.store.updatingVisible}
              >
                {this.props.store.availableZoomLevels.map((item, i) => (
                  <option key={i} value={i}>
                    {item}
                  </option>
                ))}
              </select>
              <button
                className="button"
                onClick={() => this.incIndexSelectedZoomLevel()}
                disabled={this.props.store.updatingVisible}
              >
                +
              </button>
            </>
          </span>

          <span style={{ marginLeft: "30px" }}>
            <button
              className="button"
              onClick={() => this.shift(-100)}
              disabled={this.props.store.updatingVisible}
            >
              &lt;&lt;
            </button>
            <button
              className="button"
              onClick={() => this.shift(-50)}
              disabled={this.props.store.updatingVisible}
            >
              &lt;
            </button>{" "}
            Pangenome Bin Position:
            <>
              <input
                type="number"
                value={this.props.store.editingPosition} // TODO Get methods don't work here, but I don't know why. Need to ask Robert Buels.
                onChange={this.handleShift.bind(this)}
                style={{ width: "80px" }}
                disabled={this.props.store.updatingVisible}
              />
              {/*-
              <input
                type="number"
                value={this.props.store.getEndBin}
                readOnly
                style={{ width: "80px" }}
              />*/}
            </>
            <button
              className="button"
              onClick={() => this.shift(50)}
              disabled={this.props.store.updatingVisible}
            >
              &gt;
            </button>
            <button
              className="button"
              onClick={() => this.shift(100)}
              disabled={this.props.store.updatingVisible}
            >
              &gt;&gt;
            </button>
            {/*Debuggin fields: need to remove later*/}
            <span style={{ marginLeft: "10px" }}>
              Begin Bin:
              <input
                type="number"
                value={this.props.store.getBeginBin}
                disabled={true}
                style={{ width: "80px" }}
              />
            </span>
            <span style={{ marginLeft: "10px" }}>
              End Bin:
              <input
                type="number"
                value={this.props.store.getEndBin}
                disabled={true}
                style={{ width: "80px" }}
              />
            </span>
            {/*End of debugging fields*/}
          </span>
          <div className={"row"}>
            Search: {/*Need Extra attention*/}
            <span className="myarrow">
              <input
                type="checkbox"
                checked={this.props.store.searchTerms.searchGenes}
                onChange={(event) =>
                  this.props.store.updateSearchTerms(
                    this.props.store.searchTerms.path,
                    event.target.checked,
                    this.props.store.searchTerms.search
                  )
                }
              />

              <input
                type="string"
                list="path"
                name="path"
                placeholder={"Path"}
                id="#show-suggestions"
                onChange={(event) =>
                  this.props.store.updateSearchTerms(
                    event.target.value,
                    this.props.store.searchTerms.searchGenes,
                    this.props.store.searchTerms.search
                  )
                }
                value={this.props.store.searchTerms.path}
                style={{ width: "80px" }}
                // disabled
              />
            </span>
            <datalist id="path">
              {this.props.store.chunkIndex !== null
                ? this.props.store.chunkIndex.pathNames.map((item, key) => (
                    <option key={key} value={item} />
                  ))
                : null}
            </datalist>
            -
            <input
              type="search"
              placeholder={
                this.props.store.searchTerms.searchGenes
                  ? "Gene name"
                  : "Position"
              }
              onChange={(event) =>
                this.props.store.updateSearchTerms(
                  this.props.store.searchTerms.path,
                  this.props.store.searchTerms.searchGenes,
                  event.target.value
                )
              }
              style={{ width: "120px" }}
              // disabled
            />
            <span style={{ marginLeft: "2px" }}>
              <button
                className="button"
                onClick={() => this.handleJump()}
                // disabled
              >
                Jump
              </button>
            </span>
            <span style={{ marginLeft: "30px" }}>
              Pangenome Last Bin: {this.props.store.last_bin_pangenome}
            </span>
            <span style={{ marginLeft: "30px" }}>
              Num. of individuals:{" "}
              {this.props.store.chunkIndex === null
                ? 0
                : this.props.store.chunkIndex.pathNames.length}
            </span>
            {/* This block prints array with selected components. Can be used for any other parameters.
              DEBUG ONLY!!!
            <span style={{ marginLeft: "30px" }}>
              [{this.props.store.selectedComponents.map(pair => {return pair.toString()}).join('], [') }]
            </span>*/}
          </div>
          <div className={"row"}>
            <span>
              {" "}
              Hide inversion links:
              <input
                type="checkbox"
                checked={this.props.store.hideInversionLinks}
                onChange={this.props.store.toggleHideInversionLinks}
              />
            </span>
            <span>
              {" "}
              Highlight accessions:
              <input
                type="checkbox"
                checked={this.props.store.doHighlightRows}
                onChange={this.props.store.toggleDoHighlightRows}
              />
            </span>
            <span>
              {" "}
              Dimmed by default:
              <input
                type="checkbox"
                checked={this.props.store.preferHighlight}
                onChange={this.props.store.togglePreferHighlight}
                disabled={!this.props.store.doHighlightRows}
              />
            </span>
            <span>
              {" "}
              Show copies:
              <input
                type="checkbox"
                checked={this.props.store.colourRepeats}
                onChange={this.props.store.toggleColourRepeats}
              />
            </span>

            {/*<span>
              {" "}
              Show Only Rearrangements:
              <WidthCompressedViewSwitch store={this.props.store} />
            </span>
            {this.props.store.useWidthCompression ? (
              <React.Fragment>
                <span>
                  {" "}
                  Render Connectors:
                  <RenderConnectorSwitch store={this.props.store} />
                </span>
              </React.Fragment>
            ) : (
              <></>
              /*
              // At the moment the gene annotation will be always displayed if present
              <span>
                {" "}
                    Display gene annotations:
                <Observer>
                  {() => <ColorGeoSwitch store={this.props.store} />}
                </Observer>
              </span>
              
            )}*/}
            <span>
              {" "}
              Row Height:
              <input
                type="number"
                min={1}
                value={this.props.store.pixelsPerRow}
                onChange={this.props.store.updateHeight}
                style={{ width: "50px" }}
              />
            </span>
            <span>
              {" "}
              Column Width:
              <input
                type="number"
                min={1}
                value={this.props.store.editingPixelsPerColumn}
                onChange={this.handleChangeWidth.bind(this)}
                style={{ width: "50px" }}
              />
            </span>

            <span>
              &nbsp;
              <a
                href={"https://github.com/graph-genome/Schematize/wiki"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>Pantograph Tutorial</strong>
              </a>
              {/*<button className="button" onClick={() => this.testJSON()}>
              Test json cache!
            </button>
            <button className="button" onClick={() => this.testChunkIndex()}>
              Test chunk index!
            </button>*/}
            </span>
          </div>
        </div>
      );
    }
  }
);

ControlHeader.propTypes = {
  store: PropTypes.object,
};

class VerticalCompressedViewSwitch extends React.Component {
  render() {
    return (
      <Observer>
        {() => (
          <input
            type="checkbox"
            checked={this.props.store.useVerticalCompression}
            onChange={this.props.store.toggleUseVerticalCompression}
            disabled
          />
        )}
      </Observer>
    );
  }
}

VerticalCompressedViewSwitch.propTypes = {
  store: PropTypes.object,
};

class RenderConnectorSwitch extends React.Component {
  render() {
    return (
      <Observer>
        {() => (
          <input
            type="checkbox"
            checked={this.props.store.useConnector}
            onChange={this.props.store.toggleUseConnector}
            disabled
          />
        )}
      </Observer>
    );
  }
}

RenderConnectorSwitch.propTypes = {
  store: PropTypes.object,
};

class WidthCompressedViewSwitch extends React.Component {
  render() {
    return (
      <Observer>
        {() => (
          <input
            type="checkbox"
            checked={this.props.store.useWidthCompression}
            onChange={this.props.store.toggleUseWidthCompression}
            disabled
          />
        )}
      </Observer>
    );
  }
}

WidthCompressedViewSwitch.propTypes = {
  store: PropTypes.object,
};

export default ControlHeader;

/*class ColorGeoSwitch extends React.Component {
  render() {
    return (
        <input
          type="checkbox"
          checked={this.props.store.colorByGeo}
          onChange={this.props.store.toggleColorByGeo}
        />
    );
  }
}

ColorGeoSwitch.propTypes = {
  store: PropTypes.object,
};*/
