// import { $rdf } from "./libs/rdflib.min.js";
const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');

// if (!log) {
//     log = console.log;
//     console.log('overriding log in ibex');
// }

// console.log(log);
// log("ibex library loaded");
var log = (...data) => {
    if (!$) {
        console.log(data);
        return
    }

    $('#logresults').append($('<pre>').text(
        data.map(
            (e) => {
                return ('string' !== typeof e) ? JSON.stringify(e) : e
            }

        ).join(" ")))
}

class Ibex {
    myPod = null;
    myDomain = null;
    defaultFeed = 'public/main';
    myRootPath = 'is.darcy';

    constructor(myPod) {
        this.myPod = myPod;
        this.myDomain = this.urlDomain(myPod);
    }

    root() {
        return this.myDomain + '/' + this.myRootPath;
    }

    willFetch(url, pars) {
        pars = pars || {};
        pars.method = pars.method || 'GET';

        return new Promise(
            (resolve, reject) => {
                solid.auth.fetch(
                    url,
                    pars
                ).then(response => {
                    ///log("fetch:", pars.method, url, " response:", response.status, response.statusText);
                    if (!response || (response.status !== 201 && response.status !== 200)) {
                        log(url, "result:", response.status, response.statusText);
                        reject({ failure: response });
                    } else {
                        resolve(response);
                    }
                })
            }
        );
    }

    makePath(container, newFolder) {

        if (newFolder) {
            container += '/' + newFolder;
        }
        [newFolder, container] = this.basePath(container);
        log('mkdir', container, newFolder);

        let path = container + newFolder;
        return this.willFetch(path).
            catch(() => {
                log(`let's see if ${container} exists first...`);
                return this.makePath(container).then(
                    () => {

                        log(`we did not find path '${path}', let's try to create '${newFolder}' in '${container}'`);

                        return this.willFetch(
                            container,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/turtle', 'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"', "Slug": newFolder }
                            }
                        );
                    });
            });
    }
    createFeed(feedName) {
        return this.makePath(this.root(), feedName);
    }
    post(content, feed, slug) {
        if (!content) { return Promise.reject("Empty post") }
        feed = feed || this.defaultFeed;
        slug = (slug || ts()).replace(/[^a-zA-Z0-9_]/, '-');

        let uri = this.root() + '/' + feed + '/' + slug;
        return this.willFetch(uri, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: content });
    }

    /**
     * returns a nice url-compatible date string
     * @param {Date} date
     */
    ts(date) {
        date = date || new Date;
        return date.toISOString().replace(/:/g, '.');
    }


    basePath(path) {
        const separator = "/";
        if (path.slice(-1) == separator) {
            path = path.slice(0, -1);
        }
        const lastSeparatorPosition = path.lastIndexOf(separator);

        return [
            path.substr(lastSeparatorPosition + 1),
            path.substr(0, lastSeparatorPosition + 1),
        ];
    }

    urlDomain(url) {
        log("getting domain of ", url);
        var a = document.createElement('a');

        a.href = url;

        return a.protocol + '//' + a.hostname;
    }


}

function ts(date) {
    date = date || new Date;
    return date.toISOString().replace(/:/g, '.');
}

export default Ibex;
export { log, Ibex };