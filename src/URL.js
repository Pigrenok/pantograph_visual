// a collection of functions to deal with URL requests

export function urlExists(dataName) {
  if (dataName === "") {
    return false;
  } else {
    //source: https://stackoverflow.com/a/22011478/3067894
    var http = new XMLHttpRequest();
    http.open("HEAD", dataName, false);
    try {
      http.send();
    } catch (err) {
      return false;
    }

    return http.status !== 404;
  }
}

export async function httpGetAsync(theUrl, callback) {
  debugger;
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function () {
    if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
      callback(xmlHttp.responseText);
    } else {
      callback("0");
    }
  };
  await xmlHttp.open("GET", theUrl, true); // true for asynchronous
  xmlHttp.send(null);
}
