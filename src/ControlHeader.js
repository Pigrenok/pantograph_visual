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
          alert(
            `Did not find position ${search} in accession ${path_name} for case ${jsonName}.`
          );
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
          if (doSearchGenes) {
            store.updatePosition(result + 1, true, true);
          } else {
            store.updatePosition(result, true);
          }

          // store.updateBeginEndBin(result, true);
        }
      }
      // httpGetAsync(addr + "hi", printResult);
      // httpGetAsync(addr + "5/1", printResult);
      // httpGetAsync(addr + "4/3", printResult);

      let url;
      if (doSearchGenes) {
        url = `${addr}/gene/${jsonName}/${path_name}/${search}`;
      } else {
        url = `${addr}/pos/${jsonName}/${path_name}/${zoomLevel}/${search}`;
      }

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
        <div id="button-container" class="container-fluid">
          <div class="row">
            {/*<button className="button" id="btn-download">*/}
            {/*  Save Image*/}
            {/*</button>*/}
            <div class="col-auto">
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
            </div>
            <div class="col-auto">
              <div class="input-group">
                <span class="input-group-text">Bin width:</span>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onClick={() => this.incIndexSelectedZoomLevel()}
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
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onClick={() => this.decIndexSelectedZoomLevel()}
                  disabled={this.props.store.updatingVisible}
                >
                  +
                </button>
              </div>
            </div>

            <div class="col-auto">
              <div class="input-group">
                <span class="input-group-text">Pangenome Bin Position:</span>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onClick={() => this.shift(-100)}
                  disabled={this.props.store.updatingVisible}
                >
                  &lt;&lt;
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onClick={() => this.shift(-50)}
                  disabled={this.props.store.updatingVisible}
                >
                  &lt;
                </button>

                <input
                  type="number"
                  value={this.props.store.editingPosition} // TODO Get methods don't work here, but I don't know why. Need to ask Robert Buels.
                  onChange={this.handleShift.bind(this)}
                  style={{ width: "80px" }}
                  disabled={this.props.store.updatingVisible}
                />
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onClick={() => this.shift(50)}
                  disabled={this.props.store.updatingVisible}
                >
                  &gt;
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onClick={() => this.shift(100)}
                  disabled={this.props.store.updatingVisible}
                >
                  &gt;&gt;
                </button>
              </div>
            </div>

            {/*Debuggin fields: need to remove later*/}
            <div class="col-auto">
              <div class="input-group">
                <span class="input-group-text">Begin Bin:</span>
                <input
                  type="number"
                  value={this.props.store.getBeginBin}
                  disabled={true}
                  style={{ width: "80px" }}
                />
              </div>
            </div>
            <div class="col-auto">
              <div class="input-group">
                <span class="input-group-text">End Bin:</span>
                <input
                  type="number"
                  value={this.props.store.getEndBin}
                  disabled={true}
                  style={{ width: "80px" }}
                />
                {/*End of debugging fields*/}
              </div>
            </div>
          </div>
          <div class="row">
            <div class="col-auto">
              <div class="input-group">
                <div class="input-group-prepend">
                  <span class="input-group-text">Search:</span>
                </div>

                <input
                  class="form-control"
                  type="text"
                  list="path"
                  name="path"
                  placeholder={"Path"}
                  id="show-suggestions"
                  onChange={(event) =>
                    this.props.store.updateSearchTerms(
                      event.target.value,
                      this.props.store.searchTerms.searchGenes,
                      this.props.store.searchTerms.search
                    )
                  }
                  value={this.props.store.searchTerms.path}
                  style={{ width: "150px" }}
                  // disabled
                />
                <datalist id="path">
                  {this.props.store.chunkIndex !== null
                    ? this.props.store.chunkIndex.pathNames.map((item, key) => (
                        <option key={key} value={item} />
                      ))
                    : null}
                </datalist>

                <input
                  type="checkbox"
                  class="form-check-input"
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
                  class="form-control"
                  type="text"
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
                  style={{ width: "200px" }}
                  // disabled
                />
                <button
                  class="btn btn-secondary"
                  onClick={() => this.handleJump()}
                  // disabled
                >
                  Jump
                </button>
              </div>
            </div>

            <div class="col-auto">
              <div class="input-group">
                <span class="input-group-text">Filter rearrangements:</span>
                <div class="btn-group">
                  <button
                    class="btn btn-secondary dropdown-toggle"
                    type="button"
                    id="filterAccSelection"
                    data-bs-toggle="dropdown"
                    data-bs-auto-close="outside"
                    aria-expanded="false"
                  >
                    Accessions
                  </button>
                  <ul
                    class="dropdown-menu"
                    aria-labelledby="filterAccSelection"
                  >
                    <li>
                      <button
                        type="button"
                        class="btn btn-outline-light"
                        onClick={this.props.store.clearFilterPathsArray}
                      >
                        ❌ Clear
                      </button>
                    </li>
                    {this.props.store.chunkIndex !== null
                      ? this.props.store.chunkIndex.pathNames.map(
                          (item, key) => (
                            <li>
                              <div class="form-check">
                                <input
                                  class="form-check-input"
                                  type="checkbox"
                                  value={key}
                                  id={item + "Check"}
                                  checked={this.props.store.filterPaths.includes(
                                    key
                                  )}
                                  onChange={(event) =>
                                    this.props.store.changeFilterPathsArray(
                                      event.target.checked,
                                      event.target.value
                                    )
                                  }
                                />
                                <label
                                  class="form-check-label"
                                  for={item + "Check"}
                                >
                                  {item}
                                </label>
                              </div>
                            </li>
                          )
                        )
                      : null}
                  </ul>
                </div>
                <select
                  class="form-select"
                  id="mainAccSelect"
                  aria-label="Main Accession Select"
                  onChange={(event) =>
                    this.props.store.changeFilterMainPath(event.target.value)
                  }
                  disabled={this.props.store.filterPaths.length === 0}
                >
                  <option
                    value={-1}
                    selected={this.props.store.filterMainAccession === null}
                  >
                    No main accession
                  </option>
                  {this.props.store.filterPaths.map((item) => (
                    <option
                      value={item}
                      selected={this.props.store.filterMainAccession === item}
                    >
                      {this.props.store.chunkIndex.pathNames.get(item)}
                    </option>
                  ))}
                </select>

                {/* <select class='form-select' >
                  <option selected label='Select main accession'>Open this select menu</option>
                  <option value="1">One</option>
                  <option value="2">Two</option>
                  <option value="3">Three</option>
                </select>*/}

                {/*<select multiple name='accessions' id='accFilter'>
                    {this.props.store.chunkIndex !== null
                    ? this.props.store.chunkIndex.pathNames.map((item, key) => (
                        <option key={key} value={item} />
                      ))
                    : null}
                  </select>*/}
              </div>
            </div>

            <div class="col-auto">
              <label class="form-label">
                Pangenome Last Bin: {this.props.store.last_bin_pangenome}
              </label>
            </div>
            <div class="col-auto">
              <label class="form-label">
                Num. of individuals:{" "}
                {this.props.store.chunkIndex === null
                  ? 0
                  : this.props.store.chunkIndex.pathNames.length}
              </label>
            </div>
            {/* This block prints array with selected components. Can be used for any other parameters.
              DEBUG ONLY!!!
            <span style={{ marginLeft: "30px" }}>
              [{this.props.store.selectedComponents.map(pair => {return pair.toString()}).join('], [') }]
            </span>*/}
          </div>
          <div class="row">
            <div class="col-auto">
              {" "}
              <div class="form-check form-switch">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="hideInvCheck"
                  checked={this.props.store.hideInversionLinks}
                  onChange={this.props.store.toggleHideInversionLinks}
                />
                <label class="form-check-label" for="flexCheckDefault">
                  Hide inversion links
                </label>
              </div>
            </div>
            <div class="col-auto">
              <div class="form-check form-switch">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="highlightAccCHeck"
                  checked={this.props.store.doHighlightRows}
                  onChange={this.props.store.toggleDoHighlightRows}
                />
                <label class="form-check-label" for="flexCheckDefault">
                  Highlight accessions
                </label>
              </div>
            </div>
            <div class="col-auto align-middle">
              <div class="form-check form-switch">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="dimmedByDefaultCheck"
                  checked={this.props.store.preferHighlight}
                  onChange={this.props.store.togglePreferHighlight}
                  disabled={
                    !this.props.store.doHighlightRows |
                    (this.props.store.filterPaths.length > 0)
                  }
                />
                <label class="form-check-label" for="flexCheckDefault">
                  Dimmed by default
                </label>
              </div>
            </div>
            <div class="col-auto">
              <div class="form-check form-switch">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="flexCheckDefault"
                  checked={this.props.store.colourRepeats}
                  onChange={this.props.store.toggleColourRepeats}
                />
                <label class="form-check-label" for="flexCheckDefault">
                  Show copies
                </label>
              </div>
            </div>

            <div class="col-auto">
              <div class="input-group">
                <span class="input-group-text">Row Height:</span>
                <input
                  type="number"
                  class="form-control form-control-sm"
                  min={1}
                  value={this.props.store.pixelsPerRow}
                  onChange={this.props.store.updateHeight}
                  style={{ width: "50px" }}
                />
              </div>
            </div>
            <div class="col-auto">
              <div class="input-group">
                <span class="input-group-text">Column Width:</span>
                <input
                  type="number"
                  class="form-control form-control-sm"
                  min={1}
                  value={this.props.store.editingPixelsPerColumn}
                  onChange={this.handleChangeWidth.bind(this)}
                  style={{ width: "50px" }}
                />
              </div>
            </div>

            <div class="col-auto">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onClick={jsonCache.clear()}
              >
                Clear cache
              </button>
            </div>

            <div class="col-auto">
              <label class="form-label">
                [{this.props.store.filterPaths.join(", ")}]
              </label>
            </div>
            {/*<span>
              &nbsp;
              <a
                href={"https://github.com/graph-genome/Schematize/wiki"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>Pantograph Tutorial</strong>
              </a>
              
            </span>*/}
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
