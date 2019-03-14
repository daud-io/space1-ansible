
setTimeout(function() {
    connectToMaestro = function(env, isReconnect)
    {
        console.log('redirecting connection');
	var loc = window.location, new_uri;
        if (loc.protocol === "https:") {
            new_uri = "wss:";
        } else {
            new_uri = "ws:";
        }
        new_uri += "//" + loc.host;
        new_uri += "/ws";

        var url = new_uri;

        isReconnect ? 
            core.reconnect(url) : core.connectToMaestro(url);
    }
}, 1);
