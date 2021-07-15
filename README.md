# Darcy Ibex

<img width="140" alt="ibex-logo" src="https://user-images.githubusercontent.com/33927544/120767803-d7c91300-c51b-11eb-9831-be54f6a1347f.png">


Darcy Ibex is a Node library for Darcy. 

## Project setup

Run the npm installation command to install the needed dependecies.

```
npm i ibex-lib
```
*npm module will be released soon*
##Usage
Simply require the module

```js
const {Ibex} = require("ibex-lib");
const ibex = new Ibex();
```
see the *ibex.js* file for all available methods and classes.
## Tests

You can test your pod and the library by accessing the index.html file in a browser.

For this to work the library need to be *bundled* using the command:

```
npm run build-test-js 
```
