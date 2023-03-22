import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import * as serviceWorker from "./serviceWorker";
import { store } from "./ViewportInputsStore";

ReactDOM.render(
  <App store={store} selectedProject={"genegraph_tutorial"} />,
  document.getElementById("root")
);

function clearFloating() {
  store.clearHighlightCell();
  document.getElementById("floating").style.display = "none";
}

document.addEventListener("click", function handleClickOutsideBox(event) {
  if (!document.getElementById("floating").contains(event.target)) {
    clearFloating();
  }
});

document.addEventListener(
  "keydown",
  (event) => {
    var name = event.key;

    if (name === "Escape") {
      clearFloating();
    }
  },
  false
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
