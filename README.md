# Pantograph visualisation tool

Visualization component of Pantograph

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

## Getting Started


```bash
git clone ...
cd Pantograph-vis
npm install
npm run start
```

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits. You will also see any lint errors in the console.

### Build

```bash
npm run build
```

Builds the app for production to the `build` folder. It correctly bundles React in production mode and optimizes the build for the best performance.

## Metadata DB and API.

In order to use metadata API, you should have running Redis DB instance with metadata for each available project stored there. In order to do it, you need to export each project with Redis server available and its credentials passed to exporting tool (either command line ot used as Python function). The Python package that implements it available [here](...).

If Redis server is available, then do the following (given you already in the Pantograph-vis repo directory):

```bash
cd API
pip install -r requirements.txt
flask run
```

Please note, that this (as well as `npm run start`) will start development server not suitable for deployment!

If you want more robust and self contained infrastructure, which will allow you to use Pantograph-vis with Redis DB and API (all behind NGINX reverse proxy) and do all preprocessing using `pantograph` command line tool (see documentation for [pyGenGraph](...) package for more details), then the easiest option is to use Docker Compose infrastructure available in [pantograph-docker](...) repository.