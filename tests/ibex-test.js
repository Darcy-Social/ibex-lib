import { Ibex, log } from "../ibex.js";

const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');

const { AclApi, AclParser, Permissions, Agents } = SolidAclUtils;
const { READ, WRITE } = Permissions;
let aclApi = null;

let ibex = null;

let ibextest = {

    testIndex: 0,

    run() {
        ibex = new Ibex($('#user').text());

        aclApi = new AclApi(solid.auth.fetch.bind(solid.auth), { autoSave: true })

        this.testIndex = 0;
        this.runtest();

    },

    runtest() {
        if (this.testIndex >= this.tests.length) {
            log("all tests started, some promises might be lagging behind");
            return
        }
        log("running test", this.testIndex);
        setTimeout(
            () => {
                let result = this.tests[this.testIndex++]();
                if (typeof result === 'object' && typeof result.then === 'function') {
                    result.finally(() => { this.runtest() })
                    return;
                }
                this.runtest()
            },
            0
        );

    },

    tests: [
        () => {
            return ibex
                .createFeed(ibex.defaultFeed)
                .catch((res) => fail(`can't create feed ${res.url}`))
                .then((res) => ibex.willFetch(res.url))
                .then((res) => assertGoodResponse(res, "can't fetch feed ", res.url, "I just created"))
                .then((res) => aclApi.loadFromFileUrl(res.url))
                .then((doc) => assertTrue(doc.hasRule(READ, Agents.PUBLIC), "PUBLIC should have READ privilege"))
        },
        () => {
            let content = "test post " + Math.random();
            return ibex.createPost(content).then(
                res => ibex.willFetch(res.url)
            ).then((res) => {
                assertGoodResponse(res, "the post should have been posted");
                res.text().then((t) => assertEqual(content, t, "the body of the post should be what we posted"))
                ibex.getPostText(res.url).then((t) => assertEqual(content, t, "the body of the post should be what we posted"))
                return ibex.deletePost(res.url);
            }).then((res) => {
                assertGoodResponse(res, "I can't delete the post I just posted");
                return ibex.willFetch(res.url)
            }).catch((res) => {
                assertEqual(res.status, 404, "Post should have been deleted, but is somehow still there");
                return res;
            })
        },
        () => {
            return ibex.willFetch(
                ibex.myDomain + "/darcywashereyoucanremoveme.txt", {
                method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: "remove me whenever, this should not have been left here"
            }).then((r) => {
                fail("Darcy should not be able to write the file", r.url)
                return ibex.delete(r.url)
            }).catch((r) => pass("Darcy is not able to write in your root, good"))
        },
        () => {
            let giulio = 'https://giulio.localhost/profile/card#me';
            let fileUrl = ibex.myDomain + "/is.darcy/";
            const { AclApi, AclParser, Permissions } = SolidAclUtils;
            const { READ } = Permissions;

            aclApi
                .loadFromFileUrl(fileUrl)
                .then((acl) => acl.addRule(READ, giulio))
                .then(aclApi.loadFromFileUrl(fileUrl)) //again
                .then((doc) => {
                    assertTrue(doc.hasRule(READ, giulio), "giulio should have READ privilege");
                    return doc.deleteRule(READ, giulio);
                }).then(aclApi.loadFromFileUrl(fileUrl)) //againnnnn
                .then((doc) => {
                    return assertTrue(!doc.hasRule(READ, giulio), "giulio should not have READ privilege");
                });
        },
        () => {
            let testFeed = "testdeletefeed";
            let testContent = "content test post to be deleted " + new Date();
            let feedUrl = null;
            let postUrl = null;

            return ibex.createFeed(testFeed)
                .then((res) => {
                    feedUrl = res.url;
                    return ibex.createPost(testContent, testFeed)
                })
                .then(assertGoodResponse)
                .then(res => {
                    postUrl = res.url;
                    return ibex.getPostText(postUrl)
                })
                .then(postText => assertEqual(postText, testContent))
                .then(() => ibex.deleteRecursive(feedUrl))
                .then(() => {
                    return ibex.willFetch(feedUrl)
                        .then((res) => fail("Darcy should not be able to read the feed", r.url))
                        .catch((res) => pass())
                })
        }
    ]
};
function assertGoodResponse(response, ...banner) {
    banner = banner || '';
    let success = (response.status == 200 || response.status == 201);
    if (success) {
        pass();
    } else {
        fail(...banner, response.status, response.statusText);
    }
    return response;
}

function assertTrue(a, ...banner) {
    banner = banner || '';
    (!!a) ? pass() : fail(...banner, '[', a, '] should have been true-ish');
    return !!a;
}
function assertEqual(a, a1, ...banner) {
    banner = banner || '';
    let equal = a === a1;
    if (equal) {
        pass();
    } else {
        fail(banner, "Expected [", a1, ']', "should have been", '[', a, ']');
    }
    return equal;

}
function pass(...data) {
    $('#logchecks').append('✔️');
    if (!data || !data.length) { return }
    log("✔️", ...data);
}
function fail(...data) {
    $('#logchecks').append('❌');
    log("❌", ...data);
}

export default ibextest;