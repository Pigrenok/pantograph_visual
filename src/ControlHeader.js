// Done
import React from "react";
import { observer } from "mobx-react";
import { entries } from "mobx";
import "./App.css";

import { jsonCache } from "./ViewportInputsStore";

const ControlHeader = observer(
  class extends React.Component {
    // This component implements the control panel on top of the screen to control the whole viewer.
    constructor(props) {
      super(props);

      this.posTimer = null;
      this.widthTimer = null;
    }

    shift(percentage) {
      // move the matrix left (percentage<0) or right (percentage>0) by percentage % of the distance between central position and left or right edge respectively.
      const pos = this.props.store.getPosition;
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
      // That is the function that implements search for gene names or positions using API server and DB behind it.
      const store = this.props.store;
      const addr = store.pathIndexServerAddress;
      const path_name = store.searchTerms.path;
      const search = store.searchTerms.search;
      const searchType = store.searchTerms.searchType;
      const jsonName = store.selectedProjectCase;
      const zoomLevel = store.selectedZoomLevel;

      function handleSearchServerResponse(result) {
        if (result === "-1") {
          alert(
            `The search for ${search} in accession ${path_name} for case ${jsonName} did not return any results.`
          );
        } else {
          result = parseInt(result);

          result = Math.max(1, result);

          if (searchType === 0 || searchType === 2) {
            store.updatePosition(result + 1, true, true);
          } else {
            store.updatePosition(result, true);
          }
        }
      }

      let url;
      switch (searchType) {
        case 0:
          // Search gene names
          url = `${addr}/gene/${jsonName}/${path_name}/${search}`;
          break;
        case 1:
          // Search path position
          url = `${addr}/pos/${jsonName}/${path_name}/${zoomLevel}/${search}`;
          break;
        case 2:
          // Search genomic position
          url = `${addr}/genpos/${jsonName}/${path_name}/${search}`;
          break;
        default:
          alert("Unrecognisable search type. Something went wrong.");
          break;
      }

      jsonCache
        .getRaw(url)
        .then((data) => data.text())
        .then(handleSearchServerResponse.bind(this));
    }

    change_zoom_level(target) {
      // When zoom level requested to change from Select control
      this.props.store.setIndexSelectedZoomLevel(parseInt(target.value));
    }

    decIndexSelectedZoomLevel() {
      // Changing zoom level (going to more detailed view) by clicking on "+" button
      this.props.store.setUpdatingVisible();
      let indexSelZoomLevel = this.props.store.indexSelectedZoomLevel;
      if (indexSelZoomLevel > 0) {
        this.props.store.setIndexSelectedZoomLevel(indexSelZoomLevel - 1);
      } else {
        this.props.store.clearUpdatingVisible();
      }
    }

    incIndexSelectedZoomLevel() {
      // Changing zoom level (going to less detailed view) by clicking on "-" button
      this.props.store.setUpdatingVisible();
      let indexSelZoomLevel = this.props.store.indexSelectedZoomLevel;
      if (indexSelZoomLevel < this.props.store.availableZoomLevels.length - 1) {
        this.props.store.setIndexSelectedZoomLevel(indexSelZoomLevel + 1);
      } else {
        this.props.store.clearUpdatingVisible();
      }
    }

    handleShift(event) {
      // Moving the view to a different column by directly entering the column number.
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
      // Changing column width
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
            <div class="col-auto">
              {/*Project and cases selects (choices) block.*/}
              <div class="input-group">
                <select
                  id="select_project"
                  class="form-select"
                  onChange={(event) =>
                    this.props.store
                      .setSelectedProject(event.target.value)
                      .then(() => this.props.store.updatePosition(1))
                  }
                  value={this.props.store.selectedProject}
                  disabled={this.props.store.chunkLoading}
                >
                  {entries(this.props.store.projects).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
                <select
                  id="select_case"
                  class="form-select"
                  onChange={(event) =>
                    this.props.store
                      .setSelectedProjectCase(event.target.value)
                      .then(() => this.props.store.updatePosition(1))
                  }
                  value={this.props.store.selectedProjectCase}
                  disabled={
                    this.props.store.chunkLoading ||
                    this.props.store.projectCases.size == 1
                  }
                >
                  {entries(this.props.store.projectCases).map(
                    ([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
            <div class="col-auto">
              {/*Zoom control block*/}
              <div class="input-group">
                <span class="input-group-text">Zoom level:</span>
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
              {/*Position control block*/}
              <div class="input-group">
                <span class="input-group-text">Pangenome centre position:</span>
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

            {/*The following two blocks are read-only blocks showing column number of the left and right edge.*/}
            <div class="col-auto">
              <div class="input-group">
                <span class="input-group-text">Left edge Bin:</span>
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
                <span class="input-group-text">Right edge Bin:</span>
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
              {/*Search control block*/}
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
                      undefined,
                      undefined
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
                <select
                  class="form-select"
                  id="searchTypeSelect"
                  aria-label="Type of Search Select"
                  style={{ width: "200px" }}
                  onChange={(event) =>
                    this.props.store.updateSearchTerms(
                      undefined,
                      event.target.value,
                      undefined
                    )
                  }
                >
                  <option
                    value={0}
                    selected={this.props.store.searchTerms.searchType === 0}
                  >
                    Gene name
                  </option>
                  <option
                    value={1}
                    selected={this.props.store.searchTerms.searchType === 1}
                  >
                    Path position
                  </option>
                  <option
                    value={2}
                    selected={this.props.store.searchTerms.searchType === 2}
                  >
                    Genomic position
                  </option>
                </select>
                {/*<input
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
                />*/}
                <input
                  class="form-control"
                  type="text"
                  placeholder="Search term"
                  onChange={(event) =>
                    this.props.store.updateSearchTerms(
                      undefined,
                      undefined,
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
              {/*Accession filter block*/}
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

            {/*The following two labels are information only*/}
            <div class="col-auto">
              {/*Overall number of columns on the given zoom level*/}
              <label class="form-label">
                Pangenome Last Bin: {this.props.store.last_bin_pangenome}
              </label>
            </div>
            <div class="col-auto">
              {/*Number of accession*/}
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
              {/*Choice: Whether to hide basic inversion links or not*/}
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
              {/*Choice: when a mouse is over specific accession, does it need to be highlighted?*/}
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
              {/*If accessions under mouse shoul dbe highlighted, should they be bright or dull (dehighlighted) when mouse is not over any of the accession?*/}
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
              {/*Show repeats by colour change?*/}
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
              {/*Set how many pixels should each row be*/}
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
              {/*Set how many pixels each column should be.*/}
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
              {/*If there is something not working right, cache should be cleared. This button provides an easy way to do it.*/}
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onClick={jsonCache.clear()}
              >
                Clear cache
              </button>
            </div>

            {/*This is showing paths selected for filtering. DEBUG ONLY*/}
            {/*<div class="col-auto">
              <label class="form-label">
                [{this.props.store.filterPaths.join(", ")}]
              </label>
            </div>*/}
          </div>
        </div>
      );
    }
  }
);

export default ControlHeader;
