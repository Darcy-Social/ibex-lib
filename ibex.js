
// import { $rdf } from "./libs/rdflib.min.js";
const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');

// if (!log) {
//     log = console.log;
//     console.log('overriding log in ibex');
// }

// console.log(log);
// log("ibex library loaded");
var log = (...data) => {
    data = data || false;
    if (!$) {
        console.log(data);
        return data[0]
    }

    $('#logresults').append($('<pre>').text(
        data.map(
            (e) => {
                return ('string' !== typeof e) ? JSON.stringify(e, null, 2) : e
            }

        ).join(" ")));
    return data[0]
}

class Ibex {
    myPod = null;
    myDomain = null;
    defaultFeed = 'feed/main';
    myRootPath = 'is.darcy';

    constructor(myPod) {
        this.myPod = myPod;
        this.myDomain = this.urlDomain(myPod);
    }

    root() {
        return this.myDomain + '/' + this.myRootPath;
    }


    getPostText(url) { return this.getText(url); }
    getText(url) {
        return this.willFetch(url).then(
            (res) => res.text()
        )
    }
    deletePost(url) {
        return this.delete(url)
    }
    delete(url) {
        return this.willFetch(url, { method: 'DELETE' })
    }

    makePath(container, newFolder) {

        if (newFolder) {
            container += '/' + newFolder;
        }
        [newFolder, container] = this.basePath(container);
        //log('mkdir', container, newFolder);

        let path = container + newFolder;
        return this.willFetch(path).
            catch(() => {
                //log(`let's see if ${container} exists first...`);
                return this.makePath(container).then(
                    () => {

                        //log(`we did not find path '${path}', let's try to create '${newFolder}' in '${container}'`);

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
        return this.makePath(this.root(), feedName)
    }
    post(content, feed, slug, nocomment) {
        if (!content) { return Promise.reject("Missing content, won't publish") }
        feed = feed || this.defaultFeed;
        nocomment = nocomment || false;

        let now = new Date();

        slug = urlflatten(slug || ts(now));

        let path = [
            this.root(),
            feed,
            ("" + now.getFullYear()).padStart(4, '0'),
            ("" + (1 + now.getMonth())).padStart(2, '0'),
            ("" + now.getDate()).padStart(2, '0')
        ].join('/');

        let uri = path + "/" + slug + ".md";

        return this.makePath(path).then(
            () => this.willFetch(uri, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: content })
        )
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
        //log("getting domain of ", url);
        var a = document.createElement('a');

        a.href = url;

        return a.protocol + '//' + a.hostname;
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
                        //log(url, "result:", response.status, response.statusText);
                        reject(response);
                    } else {
                        resolve(response);
                    }
                })
            }
        );
    }

}

function urlflatten(s) {
    return encodeURIComponent(s);
    //return s.replace(/[^a-zA-Z0-9_]/, '-');
}

function ts(date) {
    date = date || new Date;
    return date.toISOString().replace(/:/g, '.');
}

export default Ibex;
export { log, Ibex };