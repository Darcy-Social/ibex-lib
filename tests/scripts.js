// ../ added to force local file path recognition
const {ibextest} = require("../tests/ibex-test.js");

const $rdf = require("rdflib");
const auth = require("solid-auth-client");


var log = (data) => { $('#logresults').append($('<p>').text(data)) }
window.addEventListener("load", function () {
  const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');

  // Log the user in and out on click
  const popupUri = 'popup.html';
  $('#loginbutton').click(() => auth.popupLogin({ popupUri }));
  $('#logoutbutton').click(() => { auth.logout().then(() => { updateUI() }) });
  $('#logout').toggle();

  let currentSession = null;

  $('#run').click(() => {
    $('#logresults').empty();
    $('#logchecks').empty();
    ibextest.run();
  });


  auth.trackSession(session => {
    const loggedIn = !!session;
    currentSession = session;
    $('#login').toggle(!loggedIn);
    $('#logout').toggle(loggedIn);
    if (loggedIn) {

      $('#user').text(session.webId);

      $('#origin').text(new URL(session.webId).origin);
      // Use the user's WebID as default profile
      if (!$('#profile').val()) {
        $('#profile').val(session.webId);
        //ibextest.run();
      }
    }
    updateUI();

  });

});

function updateUI() {


}
