import { Ibex, log } from "../ibex.js";
const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');

let ibex = null;

let ibextest = {

    testIndex: 0,

    run() {
        ibex = new Ibex($('#user').text());

        this.testIndex = 0;
        this.runtest();


    },

    runtest() {
        if (this.testIndex >= this.tests.length) {
            log("all tests done");
            return
        }
        log("running test", this.testIndex);
        setTimeout(
            () => { this.tests[this.testIndex++]().finally(() => { this.runtest() }) },
            0
        );

    },

    tests: [
        () => ibex.createFeed("public/main").then(assertGoodResponse),
        () => {
            let content = "test post " + Math.random();

            return ibex.post(content).then(
                res => ibex.willFetch(res.url)
            ).then(
                (res) => {
                    assertGoodResponse(res);
                    res.text().then((t) => assertEqual(content, t, "the body of the post should be what we posted"))
                    return ibex.willFetch(res.url, { method: 'DELETE' })
                }

            ).then(
                (res) => {
                    assertGoodResponse(res);
                }
            )
        },



    ]


};
function assertGoodResponse(response, banner) {
    banner = banner || '';

    let success = (response.status == 200 || response.status == 201);
    log(success ? "✔️" : "❌" + banner, response.status, response.statusText);
    return response;

}
function assertEqual(a, a1, banner) {
    banner = banner || '';
    let pass = (a === a1);
    log(pass ? ("✔️") : ("❌" + banner, a, "not equal to", a1));
    return pass;

}

export default ibextest;