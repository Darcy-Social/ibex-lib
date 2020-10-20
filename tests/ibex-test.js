import { Ibex, log, FeedLoader, FeedStreamer, FeedAggregator } from "../ibex.js";

const FOAF = new $rdf.Namespace('http://xmlns.com/foaf/0.1/');
const NS = new $rdf.Namespace("http://www.w3.org/2006/vcard/ns#")
const RDF = new $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")

const { AclApi, AclDoc, AclParser, Permissions, Agents } = SolidAclUtils;
const { READ, WRITE } = Permissions;
let aclApi = null;

let ibex = null;

let ibextest = {

    // testAAAWipeAllDarcy() {
    //     return ibex.deleteRecursive(ibex.root())

    // },
    testCanCreateFeed() {
        let feedName = "testPublic";

        return ibex
            .createFeed(feedName, [], ['https://tsojcanth.darcypod.com:8443/profile/card#me'], [])
            .catch((res) => {
                fail(`can't create feed ${feedName}`)
                console.log(res)
            })
            .then((res) => {
                return ibex.willFetch(res.url)
                    .then((res) => assertGoodResponse(res, "can't fetch feed ", res.url, "I just created"))
                    .then((res) => aclApi.loadFromFileUrl(res.url))
                    .then((doc) => assertTrue(doc.hasRule(READ, Agents.PUBLIC), "feed " + feedName + " should have public READ privilege"))
                    .then(() => ibex.manifest())
                    .then(manifest => assertTrue(manifest[res.url]))
                    .finally(() => ibex.deleteRecursive(res.url)
                        .then(() => ibex.manifest())
                        .then(manifest => assertFalse(manifest[res.url]))
                    )
            })
    },
    testCanPostInFeed() {

        let feedName = "testPost";
        let content = "test post " + Math.random();

        return ibex.createFeed(feedName)
            .then(() => ibex.createPost(content, feedName))
            .then((res) => ibex.willFetch(res.url))
            .then((res) => {

                assertGoodResponse(res, "the post should have been posted");
                res.text().then((t) => assertEqual(content, t, "the body of the post should be what we posted"))
                return ibex.getPostText(res.url)
                    .then((t) => assertEqual(content, t, "the body of the post should be what we posted"))
                    .then(() => {
                        return ibex.deletePost(res.url)
                            .then(() => ibex.getPostText(res.url))
                            .catch((res) => {
                                assertEqual(res.status, 404, "Post should have been deleted, but is somehow still there");
                                return res;
                            })
                    })
            })
    },
    testCantWriteInRoot() {

        let fileUri = ibex.root() + "../darcywashereyoucanremoveme.txt";

        return ibex.willFetch(
            fileUri, {
            method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: "remove me whenever, this should not have been left here"
        }).then((r) => {
            meh("Darcy should not be able to write the file", r.url)
            return ibex.delete(r.url)
        }).catch((r) => pass("Darcy is not able to write in your root, good"))
    },
    testCanGrant() {
        let giulio = 'https://giulio.localhost/profile/card#me';
        let fileUrl = ibex.root() + "removabletestfile.txt";
        const { AclApi, AclParser, Permissions } = SolidAclUtils;
        const { READ } = Permissions;

        return ibex.willFetch(
            fileUrl, {
            method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: "remove me whenever, this should not have been left here"
        })
            .then(() => aclApi.loadFromFileUrl(fileUrl))
            .then((acl) => acl.addRule(READ, giulio))
            .then(() => aclApi.loadFromFileUrl(fileUrl)) //again
            .then((doc) => {
                assertTrue(doc.hasRule(READ, giulio), "giulio should have READ privilege");
                return doc.deleteRule(READ, giulio);
            }).then(() => aclApi.loadFromFileUrl(fileUrl)) //againnnnn
            .then((doc) => assertTrue(!doc.hasRule(READ, giulio), "giulio should not have READ privilege"))
            .then(() => ibex.deleteRecursive(fileUrl))
            ;
    },
    testCanDeletePosts() {
        let testFeed = "testdelete";
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
    },
    testCanUpdateSettings() {
        let testkey = "test-" + new Date();
        let testValue = Math.random();
        let originalSettings = {};
        return ibex.loadSettings()
            .then((oldSettings) => {
                originalSettings = oldSettings;
                return ibex.loadSettings();
            })
            .then((settings) => {
                settings[testkey] = testValue;
                return ibex.saveSettings(settings);
            })
            .then((res) => assertGoodResponse(res))
            .then(() => ibex.loadSettings())
            .then((newSettings) => {
                assertEqual(testValue, newSettings[testkey], "the added config value was not saved");
                delete newSettings[testkey];
                return ibex.saveSettings(newSettings);
            })
            .then((res) => {
                assertGoodResponse(res, "sembra aver salvato");
                return ibex.loadSettings()
            })
            .then((finalSettings) => assertEqual(originalSettings, finalSettings))
            .catch((res) => {
                fail("we failed to update settings, check the console");
                console.log(res);
            })
            .finally(() => ibex.saveSettings(originalSettings))
    },
    testLoader() {
        // load feed
        let testFeed = "testload";
        let testContent = () => { return "content test post to be deleted " + new Date(); }
        let feedUrl = null;
        let loader = null;

        let expectedPosts = [];

        return ibex.createFeed(testFeed)
            .then((res) => {
                feedUrl = res.url;
                loader = new FeedLoader(feedUrl);
                return loader.load()
            })
            .then((posts) => {
                assertEqual(loader.posts(), []);
                return ibex.createPost(testContent(), testFeed)
                    .then((res) => {
                        expectedPosts.push(res.url);
                        return loader.load()
                    })
            })
            .then((posts) => {
                assertEqual(loader.posts(), posts)
                assertEqual(expectedPosts, loader.posts());
                return ibex.createPost(testContent(), testFeed)
                    .then((res) => {
                        expectedPosts.push(res.url);
                        return loader.loadNewer()
                    })
            })
            .then((posts) => {
                assertEqual(expectedPosts, posts);
            })
            .finally(() => {
                return ibex.deleteRecursive(feedUrl)
            });
    },
    async testSynthAggregators() {
        let mockStreamers = [
            {
                feed: "https://gaia.solid.community/is.darcy/feed/testAggregator1/",
                urls: [
                    "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T10.12.54.465Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T12.12.52.879Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T14.12.51.349Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T16.12.50.096Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T18.12.48.998Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T20.12.48.397Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T22.12.48.397Z.md"
                ]
            },
            {
                feed: "https://gaia.solid.community/is.darcy/feed/testAggregator2/",
                urls: [
                    "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T10.12.58.087Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T12.12.54.953Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T14.12.52.485Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T16.12.50.498Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T18.12.49.305Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T20.12.48.400Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T22.12.48.400Z.md"
                ]
            },
            {
                feed: "https://gaia.solid.community/is.darcy/feed/testAggregator3/",
                urls: [
                    "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T10.13.00.266Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T12.12.56.773Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T14.12.53.471Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T16.12.51.034Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T18.12.49.274Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T20.12.48.403Z.md",
                    "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T22.12.48.403Z.md"
                ]
            }
        ].map((e) => new MockStreamer(e.feed, e.urls));



        let gator = new FeedAggregator();
        gator.streamers = mockStreamers;
        let posts = [];
        let olderUrl = null;

        while ((olderUrl = await gator.getNextOlderPostUrl())) {
            posts.push(olderUrl)
        }
        // log(posts);

        let expected = [
            "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T10.12.54.465Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T12.12.52.879Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T14.12.51.349Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T16.12.50.096Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T18.12.48.998Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T20.12.48.397Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator1/2020/09/24/2020-09-24T22.12.48.397Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T10.12.58.087Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T12.12.54.953Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T14.12.52.485Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T16.12.50.498Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T18.12.49.305Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T20.12.48.400Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator2/2020/09/24/2020-09-24T22.12.48.400Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T10.13.00.266Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T12.12.56.773Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T14.12.53.471Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T16.12.51.034Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T18.12.49.274Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T20.12.48.403Z.md",
            "https://gaia.solid.community/is.darcy/feed/testAggregator3/2020/09/24/2020-09-24T22.12.48.403Z.md"

        ].sort(rubbishUrlcomparator);
        // log(posts)
        // log(gator.posts)
        assertEqual(expected, gator.posts)
        return assertEqual(expected, posts)
    },
    testLoader() {

        let testFeed = "testload";
        let testContent = () => { return "content test post to be deleted " + new Date(); }
        let feedUrl = null;
        let postCount = 4;
        let postsToBeFetched = 2;
        let createdPosts = []


        return ibex.createFeed(testFeed)
            .then((res) => {
                feedUrl = res.url;

                log("creating a batch of posts, this will take a while...");

                return createPosts(postCount, testFeed, testContent, new Date())
                    .then((newPosts) => {
                        createdPosts = newPosts;
                        log("done creating batch of posts");
                        let loader = new FeedLoader(feedUrl);
                        return loader.load(postsToBeFetched)
                            .then((posts) => {
                                assertEqual(postsToBeFetched, posts.length, "the unbounded loader does not load the minimum amount of posts");
                                assertEqual(
                                    createdPosts.slice(posts.length - createdPosts.length),
                                    posts,
                                    "the loader should have loaded the first " + postsToBeFetched + " posts in the correct order");

                                let futureDate = new Date(new Date().getTime() + (86400 * 1000));
                                return ibex.createPost(testContent(), testFeed, null, null, futureDate)
                                    .then((newerPost) => {
                                        return loader.loadOlder(20)
                                            .then((posts) => {
                                                assertEqual(createdPosts, loader.posts(), "it should not have loaded the post in the future, it was looking only backwards");
                                                return loader.loadNewer();
                                            })
                                            .then((allLoadedPosts) => {
                                                createdPosts.push(newerPost.url);
                                                assertEqual(createdPosts, allLoadedPosts);
                                                // log(allLoadedPosts);
                                            })
                                    })
                            })
                    })
            })
            .then(() => {
                let streamer = new FeedStreamer(feedUrl);
                //log("streamer", streamer)

                return streamer.getNewerPostUrl()
                    .then((post) => assertEqual(createdPosts[createdPosts.length - 1], post, "should load last post"))
                    .then(() => streamer.getNewerPostUrl())
                    .then((noPost) => assertEqual(null, noPost, "Should load no more new posts"))
                    .then(() => streamer.getOlderPostUrl())
                    .then((post) => assertEqual(createdPosts[createdPosts.length - 2], post, "should load second last post"))
                    .then(() => streamer.getOlderPostUrl())
                    .then((post) => assertEqual(createdPosts[createdPosts.length - 3], post, "should load third last post"))
            })

            .finally(() => {
                return ibex.deleteRecursive(feedUrl, true)
            });


    },
    async testAggregateDifferentRealFeeds() {
        let testFeedNames = ["testAggregator1", "testAggregator2", "testAggregator3"]
        let testContent = () => { return "aggregator test post to be deleted " + new Date(); }
        let postCount = 7;
        let testFeeds = [];
        let testPosts = [];

        log("Creating three test feeds and many posts, this will take a while...");
        return Promise.all(
            testFeedNames.map(
                (feed) => ibex.createFeed(feed)
                    .then(res => {
                        //log("Created feed", res.url)
                        testFeeds.push(res.url);
                        return createPosts(postCount, feed, testContent, new Date(), -600)
                            .then((posts) => {
                                testPosts.push(...posts)
                                let a = {};
                                a[res.url] = posts;
                                return a
                            })
                    })

            ))
            .then(async (stuff) => {
                // log(Object.assign(...stuff))
                let gator = new FeedAggregator(testFeeds);
                let posts = [];

                let next = await gator.getNextOlderPostUrl();

                console.time("loadingfeeds")

                while (next) {
                    posts.push(next);
                    next = await gator.getNextOlderPostUrl();
                    //log("next post", next)
                }

                console.timeEnd("loadingfeeds")
                assertEqual(postCount * testFeedNames.length, testPosts.length)

                return assertEqual(testPosts.sort(rubbishUrlcomparator), posts)

            })
            .finally(
                () => Promise.all(testFeeds.map(f => ibex.deleteRecursive(f)))
            );


    },

    run() {
        $("#run").prop('disabled', true);
        $('#run').text("running")
        ibex = new Ibex($('#user').text());

        setInterval(() => { $("#spinner").css("transform", "rotate(" + (ibex.fetchCount * 10) + "deg)") }, 200)

        let myTests = Object.getOwnPropertyNames(this).filter(item => typeof this[item] === 'function' && item.startsWith('test'))
        this.runtest(myTests);

    },

    runtest(tests = []) {
        if (tests.length == 0) {
            log("all tests started, some promises might be lagging behind");
            $("#run").prop('disabled', false);
            $('#run').text("run")
            return
        }
        let currentTest = tests.shift();
        let currentTestElementId = log("running ", currentTest);
        let startAt = new Date();
        setTimeout(
            () => {
                try {
                    aclApi = new AclApi(solid.auth.fetch.bind(solid.auth), { autoSave: true });
                    let result = this[currentTest]();
                    // console.log(result)
                    if (typeof result === 'object' && typeof result.then === 'function') {
                        result
                            .catch((e) => {
                                crash("TEST " + currentTest + " CRASHED (promise broken)", e);
                                if (e.stack) { log("stack", stacktrace(e)) }
                                console.log("TEST " + currentTest + " CRASHED");
                                console.log(e)
                            })
                            .finally(() => {
                                $(currentTestElementId).append(" done in " + (new Date() - startAt) + "ms");
                                this.runtest(tests);
                            })
                        return;
                    }
                }
                catch (e) {
                    crash("TEST " + currentTest + " CRASHED (exception)", e);
                    if (e.stack) { log("stack", stacktrace(e)) }
                    console.log("TEST " + currentTest + " CRASHED");
                    console.log(e.stack)
                }

                $(currentTestElementId).append(" (" + (new Date() - startAt) + " ms)");
                this.runtest(tests)
            },
            0
        );
    },
};

function rubbishUrlcomparator(a, b) {
    if (a == b) { return 0 }
    return (
        a.match(/is\.darcy\/feed\/[^\/]+\/(.*)/)[1] > b.match(/is\.darcy\/feed\/[^\/]+\/(.*)/)[1]
            ? -1
            : 1
    );
}

class MockStreamer {
    posts = [];
    myUrl = '';
    constructor(url, posts) {
        this.myUrl = url;
        this.posts = posts;
    }

    async getOlderPostUrl() {
        return this.posts.pop();
    }
    async peekOlderPostUrl() {
        return this.posts[this.posts.length - 1];
    }
    url() { return this.myUrl }
}


function createPosts(count, feedName, contentGenerator, date = new Date(), deltaSeconds = -7200) {
    return ibex
        .createPost(contentGenerator(), feedName, null, null, date)
        .then((res) => {
            // createdPosts.unshift(res.url);

            count--;

            if (count) {
                return createPosts(count, feedName, contentGenerator, new Date(date.getTime() + deltaSeconds * 1000), deltaSeconds + Math.random())
                    .then((posts) => {
                        posts.push(res.url);
                        return posts;
                    });
            }
            return [res.url]
        })
}



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
function assertFalse(a, ...banner) {
    banner = banner || '';
    (!a) ? pass() : fail(...banner, '[', a, '] should have been false-ish');
    return !!a;
}
function assertEqual(expected, result, ...banner) {
    banner = banner || '';
    let equal = JSON.stringify(expected) === JSON.stringify(result);
    if (equal) {
        pass();
    } else {
        fail(banner, "[", result, ']', "should have been", '[', expected, ']');
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
    let trace = stacktrace();
    if (trace.length > 0) { log(trace) }
}
function meh(...data) {
    $('#logchecks').append('😑');
    log("😑", ...data);
    let trace = stacktrace();
    if (trace.length > 0) { log(trace) }
}

function crash(...data) {
    $('#logchecks').append('💥');
    log("💥", ...data);
}
function stacktrace(e) {
    return (e || Error()).stack.split(/\n +/g).filter((r) => {
        return !r.startsWith("at assertEqual (")
            && !r.startsWith("at assertTrue (")
            && !r.startsWith("at assertFalse (")
            && !r.startsWith("at meh (")
            && !r.startsWith("at stacktrace (")
            && !r.startsWith("at fail (")
            && r != "Error"
    });
}

export default ibextest;


